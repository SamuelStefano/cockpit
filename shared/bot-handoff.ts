export const MAX_HANDOFF_WORDS = 500;

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export type HandoffCheck = { ok: true; words: number } | { ok: false; error: string };

export function checkHandoff(text: string | null): HandoffCheck {
  if (text === null || !text.trim()) return { ok: false, error: 'falta o handoff do bot em ~/.cockpit/handoffs/<bot>.md' };
  const words = countWords(text);
  if (words > MAX_HANDOFF_WORDS) return { ok: false, error: `handoff com ${words} palavras; o teto é ${MAX_HANDOFF_WORDS}` };
  return { ok: true, words };
}
