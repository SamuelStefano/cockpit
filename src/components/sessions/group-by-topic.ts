import type { Session } from '../../data/mock';

export interface SessionGroup {
  label: string;
  items: Session[];
  // Grupo de tópico (tag) — o header ganha o traço sky/#, não o estilo de recência.
  topic?: boolean;
  // "Sem tópico": tópico, mas sem hash e em tom neutro (é o balde de resto).
  untagged?: boolean;
}

const UNTAGGED = 'Sem tópico';

// Agrupa as sessões pelos seus tópicos (as tags). Uma sessão com N tags aparece
// nos N grupos — é o modelo de rótulo (Gmail-style), não partição. Sem tag cai
// em "Sem tópico", sempre por último. Tópicos ordenam por tamanho (mais ativo
// primeiro) e, empatando, alfabético.
export function groupByTopic(list: Session[], tagMap: Record<string, string[]>): SessionGroup[] {
  const byTopic = new Map<string, Session[]>();
  const untagged: Session[] = [];
  for (const s of list) {
    const tags = tagMap[s.id];
    if (!tags || tags.length === 0) { untagged.push(s); continue; }
    for (const t of tags) {
      const arr = byTopic.get(t);
      if (arr) arr.push(s); else byTopic.set(t, [s]);
    }
  }
  const groups: SessionGroup[] = [...byTopic.entries()]
    .map(([label, items]) => ({ label, items, topic: true }))
    .sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
  if (untagged.length) groups.push({ label: UNTAGGED, items: untagged, topic: true, untagged: true });
  return groups;
}
