import type { FailureKind } from './classify';

// Cascata de modelos: o turno começa no provedor barato e só sobe pro caro quando a
// tentativa barata não entregou. É o oposto do roteador de failover vizinho — lá a
// troca é por DISPONIBILIDADE (o provedor acabou), aqui é por CAPACIDADE (o provedor
// respondeu, mas não deu conta). Os dois convivem: o failover escolhe em qual rota
// barata a tentativa roda, esta decide se vale repetir no modelo forte.

export type AttemptTier = 'cheap' | 'strong';

// Uma subida por prompt. Sem teto, um pedido que nenhum modelo resolve viraria
// pingue-pongue caro: a tentativa barata falha, a cara falha, e a barata começa de
// novo. Falhou nos dois tiers, o problema é o pedido — quem resolve é o usuário.
export const ESCALATION_CAP = 1;

export interface AttemptFacts {
  tier: AttemptTier;
  failure: FailureKind;   // veredito do classifyOutcome do turno
  tools: number;
  text: string;
  endReason?: string;     // result.subtype do CLI
  userStopped?: boolean;
  escalations: number;    // subidas já gastas neste prompt
}

export type EscalationReason = 'falha-do-provedor' | 'nada-produzido' | 'teto-do-turno';

// O CLI corta o turno sozinho e carimba o motivo no result. Bater no teto de voltas
// é o sinal mais confiável de modelo barato rodando em círculo: ele respondeu, não
// deu erro, e mesmo assim consumiu o turno inteiro sem fechar a tarefa.
const EXHAUSTED = new Set(['error_max_turns', 'error_max_budget']);

export function escalationReason(f: AttemptFacts): EscalationReason | null {
  // Stop do usuário não é fracasso do modelo — subir de tier aqui gastaria token
  // caro justamente no turno que ele mandou parar.
  if (f.userStopped) return null;
  if (f.tier !== 'cheap') return null;
  if (f.escalations >= ESCALATION_CAP) return null;
  if (f.failure !== 'ok') return 'falha-do-provedor';
  if (f.endReason && EXHAUSTED.has(f.endReason)) return 'teto-do-turno';
  // Zero tool E zero texto: o turno fechou limpo e não entregou nada. Texto sem tool
  // NÃO conta — resposta a pergunta é entrega legítima e não merece rodar de novo.
  if (f.tools === 0 && f.text.trim() === '') return 'nada-produzido';
  return null;
}

export const ESCALATION_MESSAGE: Record<EscalationReason, string> = {
  'falha-do-provedor': 'O modelo barato falhou — refazendo no modelo forte.',
  'nada-produzido': 'O modelo barato não entregou nada — refazendo no modelo forte.',
  'teto-do-turno': 'O modelo barato rodou em círculo — refazendo no modelo forte.',
};
