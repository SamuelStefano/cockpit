import type { Session } from '../../data/types';

// Quantas palavras iniciais definem "mesmo nome". Título colide raramente por
// inteiro; colide MUITO por prefixo ("Revisar PR do dfl-schema" vs "…dfl-services").
// 4 palavras é específico o bastante pra não marcar a lista toda e curto o
// bastante pra pegar o par que de fato se confunde de relance.
const PREFIX_WORDS = 4;

// A abertura da conversa é bem mais verbosa que um título, então 4 palavras ali
// casariam qualquer "deck, me ajuda a…". 8 exige que as duas primeiras frases
// batam de verdade — que é o caso dos retomes de handoff.
const DESC_WORDS = 8;

export function titleKey(title: string, words = PREFIX_WORDS): string {
  const parts = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  return parts.slice(0, words).join(' ');
}

// Ids que se confundem com outra sessão da MESMA listagem — por título parecido
// OU por abertura idêntica (dois retomes do mesmo handoff nascem com a mesma
// primeira mensagem e viram gêmeos na lista). Quem cai aqui ganha desempate na
// linha: descrição sempre visível + data/hora absoluta — ver [[SessionRow]].
export function ambiguousIds(list: Session[]): Set<string> {
  const byKey = new Map<string, string[]>();
  // `kind` separa os dois espaços de chave; sem ele um título curto podia casar
  // com a abertura de outra sessão e marcar um par que não se parece em nada.
  const push = (kind: string, value: string, id: string) => {
    if (!value) return; // sessão sem título/abertura não agrupa com as outras vazias
    const key = `${kind}:${value}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(id);
    else byKey.set(key, [id]);
  };
  for (const s of list) {
    push('t', titleKey(s.title), s.id);
    push('d', titleKey(s.summary || s.snippet, DESC_WORDS), s.id);
  }
  const out = new Set<string>();
  for (const ids of byKey.values()) {
    if (new Set(ids).size < 2) continue;
    for (const id of ids) out.add(id);
  }
  return out;
}
