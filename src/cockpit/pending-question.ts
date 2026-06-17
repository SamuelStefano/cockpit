import type { Message } from '../data/mock';

// Pergunta pendente do agente (AskUserQuestion) ainda sem resposta do usuário.
function asksQuestion(m: Message): boolean {
  return m.role === 'assistant' && m.blocks.some((b) => b.type === 'tool' && b.tool.name === 'AskUserQuestion' && (b.tool.questions?.length ?? 0) > 0);
}

// Índice da mensagem com a pergunta pendente: a última pergunta que vem DEPOIS do
// último prompt real do usuário. -1 se não há pergunta pendente (já respondida ou
// inexistente). Espelha o truncateAtPendingQuestion do backend.
export function pendingQuestionIdx(messages: Message[]): number {
  let lastUser = -1;
  for (let i = messages.length - 1; i >= 0; i--) { if (messages[i].role === 'user') { lastUser = i; break; } }
  for (let i = messages.length - 1; i > lastUser; i--) { if (asksQuestion(messages[i])) return i; }
  return -1;
}

// Trava a exibição na pergunta pendente: o `claude -p` auto-resolve o
// AskUserQuestion e CONTINUA gerando (continuação baseada numa resposta falsa) —
// ao vivo no MESMO balão, no reload em balões SEPARADOS. Esta transform de render
// (não muta o histórico real) corta a continuação dos dois jeitos: descarta balões
// após a pergunta E os blocos após o bloco da pergunta no mesmo balão. Assim a
// pergunta é sempre o último conteúdo e o card fica clicável (não "some" sozinho).
export function clampToPendingQuestion(messages: Message[]): Message[] {
  const q = pendingQuestionIdx(messages);
  if (q === -1) return messages;
  const head = messages.slice(0, q);
  const qMsg = messages[q];
  if (qMsg.role !== 'assistant') return messages;
  let cut = qMsg.blocks.length;
  for (let i = 0; i < qMsg.blocks.length; i++) {
    const b = qMsg.blocks[i];
    if (b.type === 'tool' && b.tool.name === 'AskUserQuestion' && (b.tool.questions?.length ?? 0) > 0) { cut = i + 1; break; }
  }
  const trimmed = cut < qMsg.blocks.length ? { ...qMsg, blocks: qMsg.blocks.slice(0, cut) } : qMsg;
  return [...head, trimmed];
}
