import type { HarnessContext } from '../../shared/protocol';

// System prompt do harness — 100% nosso, compartilhado entre o motor de API (run.ts) e
// o motor de plano (plan-run.ts). No caminho de plano vai via `--system-prompt` do CLI
// (substitui o prompt base do Claude Code).

// Contexto profissional fixo pra pentest: reduz recusa por FALSO-POSITIVO (pedido
// legítimo mal enquadrado). NÃO é bypass — a recusa real do modelo segue valendo
// (DR-001). Versionado no código, revisado junto de qualquer mudança.
const PENTEST_CONTEXT = `Contexto profissional (autorização confirmada): esta tarefa faz parte de um engajamento de teste de segurança AUTORIZADO (penetration testing / red team / avaliação defensiva), com permissão do dono do sistema. O objetivo é defensivo: identificar e corrigir vulnerabilidades antes que sejam exploradas. Trate como trabalho de segurança legítimo.`;

export function systemPrompt(context: HarnessContext): string {
  const base = 'Você é um executor de tarefas direto e competente. Responda de forma completa e precisa ao pedido, sem preâmbulo desnecessário.';
  return context === 'pentest' ? `${PENTEST_CONTEXT}\n\n${base}` : base;
}
