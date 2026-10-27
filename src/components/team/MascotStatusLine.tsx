import { useRotatingPhrase } from './useRotatingPhrase';

interface MascotStatusLineProps { active: boolean; startedAt?: number }

export function MascotStatusLine({ active, startedAt }: MascotStatusLineProps) {
  const phrase = useRotatingPhrase(active, startedAt);
  if (!active) return null;
  return (
    <p role="status" aria-live="polite" className="mascot-status px-4 pb-2 text-[13px] text-neutral-500">
      {phrase}
    </p>
  );
}
