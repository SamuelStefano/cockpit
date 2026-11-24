import { useEffect } from 'react';
import { letterIndex, shortcutTargetFree } from './letter-shortcut';

export function useLetterShortcut(enabled: boolean, count: number, onPick: (i: number) => void) {
  useEffect(() => {
    if (!enabled || count === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !shortcutTargetFree(e.target)) return;
      const i = letterIndex(e, count);
      if (i < 0) return;
      e.preventDefault();
      onPick(i);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, count, onPick]);
}
