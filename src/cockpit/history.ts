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
  const byId = new Map(local.map((m) => [m.id, m]));
  // Stats do turno: o snapshot do JSONL não tem costUsd (só o stream ao vivo tem)
  // e pode nem ter stats (turno recém-fechado). Sem este merge, o re-fetch do
  // session-touched apagava a linha "Xk tokens · $0.04" que o 'done' acabou de
  // carimbar — o custo sumia pra sempre no próximo open.
  const merged = incoming.map((m) => {
    if (m.role !== 'assistant') return m;
    const prev = byId.get(m.id);
    if (!prev || prev.role !== 'assistant' || !prev.stats) return m;
    if (!m.stats) return { ...m, stats: prev.stats };
    if (m.stats.costUsd === undefined && prev.stats.costUsd !== undefined) {
      return { ...m, stats: { ...m.stats, costUsd: prev.stats.costUsd } };
    }
    return m;
  });
  const ids = new Set(incoming.map((m) => m.id));
  // A bolha do run ao vivo nasce com id sintético (a-xxx) que nunca casa com o
  // uuid do JSONL — o costUsd carimbado no 'done' se perderia já no primeiro
  // re-fetch (touch trailing ~600ms depois). Herda o custo da bolha órfã pro
  // ÚLTIMO assistant do snapshot (o turno que acabou de fechar); dali em diante
  // o uuid real propaga pelo merge por id acima.
  const orphan = [...local].reverse().find(
    (m): m is Extract<Message, { role: 'assistant' }> =>
      m.role === 'assistant' && m.stats?.costUsd !== undefined && !ids.has(m.id),
  );
  if (orphan) {
    for (let i = merged.length - 1; i >= 0; i--) {
      const m = merged[i];
      if (m.role !== 'assistant') continue;
      if (m.stats && m.stats.costUsd === undefined) {
        merged[i] = { ...m, stats: { ...m.stats, costUsd: orphan.stats!.costUsd } };
      }
      break;
    }
  }
  const lastTs = incoming.length ? (incoming[incoming.length - 1].ts ?? 0) : 0;
  const inflight = local.filter((m) => !ids.has(m.id) && m.ts !== undefined && m.ts >= lastTs);
  return inflight.length ? [...merged, ...inflight] : merged;
}
