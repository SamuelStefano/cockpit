import { composerStatus, type ContextTone } from './composer-status';
import { tokens } from '../primitives';

interface ComposerStatusLineProps {
  contextTokens: number;
  contextModel?: string | null;
  queued: number;
  onOpenQueue?: () => void;
}

const dotTone: Record<ContextTone, string> = {
  ok: 'bg-(--ok)',
  warn: 'bg-(--warn)',
  err: 'bg-(--err)',
};

export function ComposerStatusLine({ contextTokens, contextModel, queued, onOpenQueue }: ComposerStatusLineProps) {
  const status = composerStatus(contextTokens, contextModel, queued);
  if (!status) return null;
  const { context } = status;
  return (
    <div className="mt-1.5 flex items-center justify-center gap-1 text-[11px] text-(--text-muted)">
      {context && (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dotTone[context.tone]}`} data-tone={context.tone} />
          {context.pct}% do contexto
        </span>
      )}
      {context && status.queued > 0 && <span aria-hidden>·</span>}
      {status.queued > 0 && (
        <button
          type="button" onClick={onOpenQueue}
          className={`rounded-sm underline-offset-2 hover:text-neutral-300 hover:underline ${tokens.focusRing}`}
        >
          {status.queued} na fila
        </button>
      )}
    </div>
  );
}
