export const LETTERS = ['A', 'B', 'C', 'D'];

export const letterFor = (i: number) => LETTERS[i] ?? String(i + 1);

interface KeyLike { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; repeat?: boolean }

// Index of the option a bare A–D press picks, or -1.
export function letterIndex(e: KeyLike, count: number): number {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.key.length !== 1) return -1;
  const i = LETTERS.indexOf(e.key.toUpperCase());
  return i < count ? i : -1;
}

// The shortcut only fires when it cannot eat typing: focus outside any text
// field, or in one that is still empty (the composer before the first letter).
export function shortcutTargetFree(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return true;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return target.value === '';
  return !target.isContentEditable;
}
