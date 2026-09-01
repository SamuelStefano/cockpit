import type { Session } from '../../data/types';

// Agrupa as sessões por recência (estilo ChatGPT/Claude). Fixadas viram um grupo
// próprio no topo; o resto cai num balde por mtime. Só roda fora da busca.
export const WAITING_LABEL = 'Aguardando você';
export const RUNNING_LABEL = 'Trabalhando agora';

export function groupByRecency(list: Session[], pinned: Set<string>, running?: Set<string>): { label: string; items: Session[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  const buckets: { label: string; items: Session[] }[] = [
    { label: RUNNING_LABEL, items: [] },
    { label: WAITING_LABEL, items: [] },
    { label: 'Fixadas', items: [] },
    { label: 'Hoje', items: [] },
    { label: 'Ontem', items: [] },
    { label: '7 dias', items: [] },
    { label: '30 dias', items: [] },
    { label: 'Anteriores', items: [] },
  ];
  for (const s of list) {
    // Rodando vence "aguardando": o turno voltou a andar, a pergunta de antes já
    // não é o que te trava. Aguardando vence fixada — é a fila acionável do dia.
    if (running?.has(s.id)) { buckets[0].items.push(s); continue; }
    if (s.waiting) { buckets[1].items.push(s); continue; }
    if (pinned.has(s.id)) { buckets[2].items.push(s); continue; }
    if (s.mtime >= startOfToday) buckets[3].items.push(s);
    else if (s.mtime >= startOfToday - day) buckets[4].items.push(s);
    else if (s.mtime >= startOfToday - 7 * day) buckets[5].items.push(s);
    else if (s.mtime >= startOfToday - 30 * day) buckets[6].items.push(s);
    else buckets[7].items.push(s);
  }
  return buckets.filter((b) => b.items.length > 0);
}
