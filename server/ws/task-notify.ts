// Notificação de subagente de background: o harness injeta um user-turn sintético
// com XML `<task-notification>…<task-id>…<status>…` cada vez que o agente para.
// Um agente zumbi (parado no limite de sessão) re-notifica a cada retomada e o
// turno principal nunca fecha — vira spam no chat. Estes helpers detectam e contam.

export interface TaskNotify {
  taskId: string;
  status: string;
}

// Extrai task-id/status de um content de evento `user` (string ou blocks de texto).
// Regex tolerante (não parser estrito): versões do CLI variam o XML; em dúvida, null.
export function parseTaskNotification(content: unknown): TaskNotify | null {
  const text = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map((c) => (c && typeof c === 'object' && typeof (c as { text?: unknown }).text === 'string' ? (c as { text: string }).text : '')).join('\n')
      : '';
  if (!text.includes('<task-notification>')) return null;
  const taskId = /<task-id>([^<]*)<\/task-id>/.exec(text)?.[1]?.trim() ?? '';
  const status = /<status>([^<]*)<\/status>/.exec(text)?.[1]?.trim() ?? '';
  if (!taskId) return null;
  return { taskId, status };
}

// Conta notificações por task-id no turno. Acima do limite = loop de zumbi. Uma
// primeira notificação 'completed' nunca é loop (conclusão legítima).
export function registerNotify(seen: Map<string, number>, tn: TaskNotify, limit = 3): 'ok' | 'loop' {
  const n = (seen.get(tn.taskId) ?? 0) + 1;
  seen.set(tn.taskId, n);
  return n >= limit ? 'loop' : 'ok';
}
