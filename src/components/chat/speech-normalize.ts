// Cleans up pt-BR dictation: maps misheard English/tech words to the canonical
// spelling, collapses elongated vowels and drops hesitation fillers.

// canonical -> misheard variants. Add entries here; each variant also matches its
// plural (variant + "s" -> canonical + "s"). Only list variants that are not real
// Portuguese words ("chá", "chato", "chave" must never be here).
export const DICTATION_VOCAB: Record<string, string[]> = {
  chat: ['xat', 'tchat', 'tchát', 'chét', 'chéti', 'chéte', 'chet', 'xét', 'chati'],
  deck: ['dek', 'déck', 'dék', 'déqui', 'dequi'],
  kanban: ['canban', 'kambam', 'camban'],
  PR: ['pê érre', 'pê erre', 'pi érre', 'pi erre'],
  Tainan: ['taynan', 'tainam'],
};

const LETTER = String.raw`[\p{L}\p{N}]`;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const VOCAB_RULES = Object.entries(DICTATION_VOCAB).map(([canonical, variants]) => ({
  canonical,
  re: new RegExp(
    `(?<!${LETTER})(${variants.map((v) => escape(v).replace(/ /g, '\\s+')).join('|')})(s?)(?!${LETTER})`,
    'giu',
  ),
}));

function applyVocab(text: string): string {
  let out = text;
  for (const { canonical, re } of VOCAB_RULES) {
    out = out.replace(re, (match, _variant: string, plural: string) => {
      const keepsCase = canonical === canonical.toLowerCase();
      const head = keepsCase && /^\p{Lu}/u.test(match) ? canonical[0].toUpperCase() + canonical.slice(1) : canonical;
      return head + plural.toLowerCase();
    });
  }
  return out;
}

const FILLER = '(?:é{2,}|h?ã+h*|ãh+|ahn+|hum+|hmm+|ehh+)';
const FILLER_RE = new RegExp(`(?<!${LETTER})${FILLER}(?!${LETTER})(,?)([ \\t]*)`, 'giu');
const MARK = '\u0000';

function dropFillers(text: string): string {
  const marked = text.replace(FILLER_RE, (_m, _comma: string, _space: string, offset: number, whole: string) => {
    const before = whole.slice(0, offset);
    return /(^\s*|[.!?…]\s+)$/.test(before) ? MARK : '';
  });
  return marked.replace(new RegExp(`${MARK}+(\\s*)(\\p{L})?`, 'gu'), (_m, space: string, letter?: string) =>
    (letter ? space + letter.toUpperCase() : space),
  );
}

// 3+ of the same letter in a row is never Portuguese ("praaa", "genteee"); 2 is
// ("cooperar", "leem"), so it stays. "www" is kept.
function collapseElongation(text: string): string {
  return text.replace(/(?![wW])(\p{L})\1{2,}/giu, '$1');
}

export function normalizeDictation(text: string): string {
  if (!text) return text;
  return applyVocab(collapseElongation(dropFillers(text)));
}
