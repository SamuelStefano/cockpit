import { useEffect, useRef } from 'react';
import { KONAMI, sequenceMatcher, wordMatcher, isTypingTarget } from './eggs';

interface Handlers { onKonami: () => void; onGod: () => void; onMatrix: () => void }

// Ignores keys typed into fields, so a chat message containing "matrix" never
// triggers anything; the matchers only ever see keys pressed outside inputs.
export function useEggKeys(handlers: Handlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const konami = sequenceMatcher(KONAMI);
    const god = wordMatcher('iddqd');
    const matrix = wordMatcher('matrix');
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      try {
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (konami(k)) ref.current.onKonami();
        if (god(e.key)) ref.current.onGod();
        if (matrix(e.key)) ref.current.onMatrix();
      } catch {
        /* best-effort */
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
