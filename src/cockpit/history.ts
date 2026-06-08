import type { Message } from '../../shared/protocol';

// O `history`/`open` traz o snapshot autoritativo do JSONL e o handler troca o thread
// inteiro por ele. Mas uma bolha de usuário otimista (add no `onSend`) ainda NÃO foi
// persistida quando o snapshot é tirado — se o eco `user` chegar antes do `history`,
// a troca cega apaga a bolha e ela só reaparece no F5 (relê o JSONL já persistido).
// Isto é o #165. mergeHistory mantém as mensagens locais em voo (id ausente no
// snapshot E mais novas que ele) anexadas ao fim; quando persistirem, o próximo
// snapshot já as inclui e o dedup por id evita duplicata.
export function mergeHistory(incoming: Message[], local: Message[]): Message[] {
  if (!local.length) return incoming;
  const ids = new Set(incoming.map((m) => m.id));
  const lastTs = incoming.length ? (incoming[incoming.length - 1].ts ?? 0) : 0;
  const inflight = local.filter((m) => !ids.has(m.id) && m.ts !== undefined && m.ts >= lastTs);
  return inflight.length ? [...incoming, ...inflight] : incoming;
}
