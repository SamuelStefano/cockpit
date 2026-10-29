import { usePersisted } from '../../lib/persist';
import { contextMeter } from './toolbar-format';
import { lifeBar } from './life-bar';

interface ContextLifeBarProps {
  sessionId?: string;
  contextTokens: number;
  contextModel?: string | null;
}

// Touch screens only: a 2px strip under the header whose width is the context fill. A tap
// brings the handoff banner back if it was dismissed.
export function ContextLifeBar({ sessionId, contextTokens, contextModel = null }: ContextLifeBarProps) {
  const [, setDismissed] = usePersisted<Record<string, string>>('satDismissed', {});
  const bar = lifeBar(contextMeter(contextTokens, contextModel)?.pct);
  if (!bar) return null;
  const reopen = () => {
    if (!sessionId) return;
    setDismissed((d) => {
      const next = { ...d };
      delete next[sessionId];
      return next;
    });
  };
  return (
    <button
      type="button" onClick={reopen} aria-label={`Contexto em ${bar.pct}%`}
      className="relative -mb-2 hidden h-[10px] w-full shrink-0 items-start pointer-coarse:flex"
    >
      <span aria-hidden className={`block h-0.5 rounded-r-full ${bar.pulse ? 'breathe' : ''}`} style={{ width: `${bar.pct}%`, background: bar.color }} />
    </button>
  );
}
