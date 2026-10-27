import { useEffect, useRef, useState } from 'react';
import { useRotatingPhrase } from './useRotatingPhrase';

export const PHRASE_LINGER_MS = 1_500;

interface LivingPhraseProps {
  active: boolean;
  startedAt?: number;
  live?: boolean;
  className?: string;
}

function useLinger(active: boolean): boolean {
  const [shown, setShown] = useState(active);
  useEffect(() => {
    if (active) { setShown(true); return; }
    const t = setTimeout(() => setShown(false), PHRASE_LINGER_MS);
    return () => clearTimeout(t);
  }, [active]);
  return active || shown;
}

// One phrase at a time; when it changes the old one fades out under the new one
// (200 ms cross-fade, see index.css) and the whole line goes 1.5 s after the turn ends.
export function LivingPhrase({ active, startedAt, live = false, className = '' }: LivingPhraseProps) {
  const phrase = useRotatingPhrase(active, startedAt);
  const visible = useLinger(active);
  const last = useRef(phrase);
  const [prev, setPrev] = useState<string | null>(null);
  useEffect(() => {
    if (last.current === phrase) return;
    setPrev(last.current);
    last.current = phrase;
    const t = setTimeout(() => setPrev(null), 220);
    return () => clearTimeout(t);
  }, [phrase]);
  if (!visible) return null;
  return (
    <span
      {...(live ? { role: 'status', 'aria-live': 'polite' as const } : {})}
      className={`living-phrase relative block truncate ${className}`}
    >
      {prev && <span aria-hidden className="living-phrase-out absolute inset-0 truncate">{prev}</span>}
      <span key={phrase} className={prev ? 'living-phrase-in block truncate' : 'block truncate'}>{phrase}</span>
    </span>
  );
}
