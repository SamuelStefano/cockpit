export const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export function sequenceMatcher(sequence: readonly string[]): (key: string) => boolean {
  // Suffix comparison over a rolling buffer, not an index counter: a counter
  // mishandles sequences whose prefix repeats (the Konami code starts with two Ups).
  let buf: string[] = [];
  return (key) => {
    buf.push(key);
    if (buf.length > sequence.length) buf = buf.slice(-sequence.length);
    if (buf.length === sequence.length && buf.every((k, i) => k === sequence[i])) {
      buf = [];
      return true;
    }
    return false;
  };
}

export function wordMatcher(word: string): (key: string) => boolean {
  const match = sequenceMatcher([...word.toLowerCase()]);
  return (key) => key.length === 1 && match(key.toLowerCase());
}

export function isTypingTarget(el: EventTarget | null): boolean {
  const e = el as HTMLElement | null;
  if (!e || typeof e.tagName !== 'string') return false;
  const tag = e.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.isContentEditable === true;
}

export function dayOfYear(d: Date): number {
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000);
}

export const isProgrammersDay = (d: Date): boolean => dayOfYear(d) === 256;
export const isHalloween = (d: Date): boolean => d.getMonth() === 9 && d.getDate() === 31;
export const isChristmas = (d: Date): boolean => d.getMonth() === 11 && d.getDate() === 25;
export const isNewYear = (d: Date): boolean => d.getMonth() === 0 && d.getDate() === 1;
export const isFridayAfternoon = (d: Date): boolean => d.getDay() === 5 && d.getHours() >= 16;

export const EGG_IDS = ['konami', 'iddqd', 'matrix', 'poke', 'dizzy', 'sudo', 'halloween', 'friday'] as const;
export type EggId = (typeof EGG_IDS)[number];
