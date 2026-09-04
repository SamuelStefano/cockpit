import type { PlanUsage } from '../../shared/protocol';
import { estimateSendCost, fitsInWindow, type Sample, type SendCost } from '../../shared/send-cost';
import { lastUsageOf } from '../db';

// Gate de CONTEXTO do turno. Roda antes do spawn, no startRun.
//
// O incidente de 04/09/2026 não foi um turno caro: foram quatro sessões enormes
// tocadas em 3 minutos. Nenhuma guarda existente via isso — `quotaHold` só age em
// 100% (tarde demais) e `MAX_DRAIN_PER_PASS` só cobre o drainer, não o usuário
// digitando. Aqui a decisão olha o tamanho da sessão, a temperatura do cache e o
// que sobrou da janela, junto.

// Leitura LITERAL de cada env (e não `process.env[nome]`): o env-example.test.ts
// varre o código atrás de `process.env.X` pra provar que toda var lida está
// documentada. Com acesso dinâmico ele não enxerga nenhuma delas.
function envInt(raw: string | undefined, def: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : def;
}

// Aviso: a UI já mostra o SaturationBanner a partir de 80% da janela de 200k
// (src/components/chat/saturation.ts). Este é o MESMO ponto, do lado do servidor —
// aqui ele só rotula o turno como caro; quem oferece a migração é o banner.
export const CTX_SOFT = envInt(process.env.COCKPIT_CTX_SOFT, 160_000);

// Acima disto o Deck RECUSA continuar a sessão. É o 92% em que o banner já vira
// 'critical': o aviso existia e foi ignorado nas quatro sessões de 04/09 — banner
// é sugestão, isto é fronteira. A saída continua sendo o botão Migrar, que destila
// pela API (server/handoff.ts) e não passa pelo startRun.
export const CTX_HARD = envInt(process.env.COCKPIT_CTX_HARD, 184_000);

// Piso pra um envio contar como "cold-start grande" e disputar o semáforo. Abaixo
// disso o cache frio custa pouco e serializar só atrasaria o usuário à toa.
export const COLD_MIN_CTX = envInt(process.env.COCKPIT_COLD_MIN_CTX, 100_000);

export const CACHE_TTL_MS = envInt(process.env.COCKPIT_CACHE_TTL_MS, 5 * 60_000);
export const WINDOW_WEIGHTED = envInt(process.env.COCKPIT_WINDOW_WEIGHTED, 6_800_000);

// Um cold-start grande por vez. Não é performance: é que dois deles somam ~28% da
// janela, e o segundo só descobre isso depois de pagar.
export const MAX_COLD_INFLIGHT = 1;

// Depois que a janela vira, esperar antes de soltar a fila. Em 04/09 uma sessão de
// 631k auto-retomou 1 MINUTO após o reset e comeu 0,77M do ciclo novo antes de o
// Samuel acordar. O #519 espalha a fila pelo tick de 30s; isto dá a folga pra ele
// e pro poll de usage (60s) chegarem antes do primeiro disparo.
export const COOLDOWN_AFTER_RESET_MS = envInt(process.env.COCKPIT_COOLDOWN_AFTER_RESET_MS, 120_000);

const costOpts = { cacheTtlMs: CACHE_TTL_MS, windowWeighted: WINDOW_WEIGHTED };

export function sampleFor(sessionId: string | undefined): Sample | null {
  if (!sessionId) return null;
  return lastUsageOf(sessionId);
}

export function costFor(sessionId: string | undefined, now = Date.now()): SendCost {
  return estimateSendCost(sampleFor(sessionId), now, costOpts);
}

// --- semáforo de cold-start ------------------------------------------------

// Por sessionKey, não contador solto: o onClose pode rodar sem o acquire ter
// acontecido (turno recusado antes do spawn) e um contador cru vazaria pra baixo
// de zero, travando a fila pra sempre.
const coldInflight = new Set<string>();

export function acquireCold(sessionKey: string): void { coldInflight.add(sessionKey); }

// Quantos cold-starts em voo IGNORANDO uma chave. Sem isso a sessão disputava o
// semáforo consigo mesma: interromper o próprio turno (triagem 'priority') passa
// pelo startRun de novo, e nos primeiros segundos — antes do turno gravar a
// primeira amostra de uso — a sessão ainda parece fria. O usuário levava
// "cold-busy" tentando redirecionar o próprio trabalho.
function coldInflightExcept(sessionKey?: string): number {
  if (!sessionKey) return coldInflight.size;
  return coldInflight.size - (coldInflight.has(sessionKey) ? 1 : 0);
}
export function releaseCold(sessionKey: string): void { coldInflight.delete(sessionKey); }
export function coldInflightCount(): number { return coldInflight.size; }
export function resetColdInflight(): void { coldInflight.clear(); }

// --- cooldown pós-reset ----------------------------------------------------

let lastResetAt = 0;
let wasHeld = false;

// Chamado onde o hold é consultado. A transição hold>0 → hold=0 É o reset: não dá
// pra ler `resetsAt` e confiar, porque o poll de usage pausa sem browser aberto.
export function noteQuotaTransition(hold: number, now = Date.now()): void {
  if (hold > 0) { wasHeld = true; return; }
  if (wasHeld) { wasHeld = false; lastResetAt = now; }
}

export function inResetCooldown(now = Date.now()): boolean {
  return lastResetAt > 0 && now - lastResetAt < COOLDOWN_AFTER_RESET_MS;
}

export function resetCooldownState(): void { lastResetAt = 0; wasHeld = false; }

// --- veredito --------------------------------------------------------------

export type Verdict =
  | { kind: 'ok'; cost: SendCost }
  | { kind: 'soft'; cost: SendCost }        // segue, mas oferece handoff no fim
  | { kind: 'hard'; cost: SendCost }        // sessão grande demais pra continuar
  | { kind: 'quota'; cost: SendCost }       // não cabe no que sobrou da janela
  | { kind: 'cold-busy'; cost: SendCost };  // outro cold-start grande em voo

export interface VerdictInput {
  sessionId?: string;
  // Chave do turno que está sendo avaliado. Só serve pro semáforo não contar o
  // próprio turno da sessão como concorrente.
  sessionKey?: string;
  usage: PlanUsage | null;
  now?: number;
}

// Ordem: hard > quota > cold-busy > soft. `hard` primeiro porque uma sessão nesse
// tamanho não deve continuar nem com a janela vazia — o problema é ela, não a cota.
export function ctxVerdict(i: VerdictInput): Verdict {
  const now = i.now ?? Date.now();
  const sample = sampleFor(i.sessionId);
  const cost = estimateSendCost(sample, now, costOpts);
  const ctx = sample?.ctxTokens ?? 0;

  if (ctx >= CTX_HARD) return { kind: 'hard', cost };
  if (!fitsInWindow(cost, i.usage?.fiveHour ?? null, costOpts)) return { kind: 'quota', cost };
  if (isBigColdStart(cost) && coldInflightExcept(i.sessionKey) >= MAX_COLD_INFLIGHT) return { kind: 'cold-busy', cost };
  if (ctx >= CTX_SOFT) return { kind: 'soft', cost };
  return { kind: 'ok', cost };
}

export function isBigColdStart(cost: SendCost): boolean {
  return cost.cold && cost.ctxTokens >= COLD_MIN_CTX;
}

// Mensagem pro usuário. Fica aqui (e não na UI) porque o mesmo texto vai pro
// broadcast de erro dos turnos SEM cliente (drainer, cron, retomada).
export function verdictMessage(v: Verdict): string {
  const k = Math.round(v.cost.ctxTokens / 1000);
  switch (v.kind) {
    case 'hard':
      return `Esta sessão está com ~${k}k de contexto (teto ${Math.round(CTX_HARD / 1000)}k). ` +
        `Continuar custaria ~${v.cost.pctOfWindow}% da janela por mensagem. Use "Migrar para um chat novo" — ` +
        'o contexto vira arquivo e a sessão nova sai barata.';
    case 'quota':
      return `Este envio custaria ~${v.cost.pctOfWindow}% da janela e não cabe no que sobrou. ` +
        'O texto voltou pro composer — mande quando a janela virar, ou migre a sessão pra baratear.';
    case 'cold-busy':
      // Só o caminho COM cliente vê este texto (o drainer deixa o item na fila e
      // tenta de novo no tick), então ele fala do composer, não de fila.
      return 'Outra sessão grande está subindo agora — dois cold-starts juntos torram a janela. ' +
        'Seu texto voltou pro composer; reenvie em alguns segundos.';
    default:
      return '';
  }
}
