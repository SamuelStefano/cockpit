import { loadPref, savePref } from '../../lib/persist';

// Histórico GLOBAL de prompts enviados (cross-sessão, persistido): a sugestão
// fantasma só com o histórico da sessão atual quase nunca dispara — você teria
// que redigitar um prompt da mesma conversa. Persistir torna o autocomplete útil.
export const PROMPT_HISTORY_MAX = 100;
// Prompt gigante (paste de log/código numa linha) não é material de autocomplete
// e incharia o localStorage — fica de fora.
export const PROMPT_MAX_CHARS = 1000;
const KEY = 'promptHistory';

export function appendPrompt(list: string[], text: string, max = PROMPT_HISTORY_MAX): string[] {
  const t = text.trim();
  if (!t || t.length > PROMPT_MAX_CHARS || t.startsWith('/') || t.includes('\n')) return list;
  const next = list.filter((p) => p !== t);
  next.push(t);
  return next.length > max ? next.slice(next.length - max) : next;
}

let cache: string[] | null = null;

export function loadPromptHistory(): string[] {
  if (cache === null) cache = loadPref<string[]>(KEY, []);
  return cache;
}

export function recordPrompt(text: string): void {
  const cur = loadPromptHistory();
  const next = appendPrompt(cur, text);
  if (next === cur) return;
  cache = next;
  savePref(KEY, next);
}
