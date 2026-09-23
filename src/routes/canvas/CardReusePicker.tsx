import type { CanvasCard } from '../../../shared/canvas';
import { Badge, ToggleChip } from '../../components/primitives';
import { REUSE_TRADEOFF_HINT, type ReuseSuggestion } from './session-reuse';

interface Props {
  reuse: CanvasCard['reuse'];
  candidates: ReuseSuggestion[];
  onClear: () => void;
  onPick: (mode: 'continue' | 'fork', candidate: ReuseSuggestion) => void;
}

// CardEditor's third choice, next to the always-available "sessão nova": ranked
// candidates (session-reuse.ts) the agent could continue in-place or fork from
// instead of starting clean. No candidates just means "nova sessão" is the only
// option, same as before this feature existed.
export function CardReusePicker({ reuse, candidates, onClear, onPick }: Props) {
  const mode = reuse?.mode ?? 'new';
  return (
    <div className="space-y-1.5">
      <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-neutral-500">Como rodar</div>
      <div className="flex flex-wrap gap-1.5">
        <ToggleChip on={mode === 'new'} icon="sparkles" onClick={onClear}>sessão nova</ToggleChip>
      </div>
      {candidates.length > 0 && (
        <div className="space-y-1">
          {candidates.map((c) => (
            <div key={c.sessionId} className="flex items-center gap-1.5 rounded-lg border border-neutral-800 px-2 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11.5px] text-neutral-200">{c.title}</div>
                <div className="truncate text-[10.5px] text-neutral-500">{c.reason}</div>
              </div>
              {c.running && <Badge tone="green" dot>rodando</Badge>}
              <ToggleChip
                on={mode === 'continue' && reuse?.sessionId === c.sessionId} disabled={c.running} icon="message"
                title={c.running ? 'sessão rodando: use fork' : 'continuar'} onClick={() => onPick('continue', c)}
              >
                continuar
              </ToggleChip>
              <ToggleChip
                on={mode === 'fork' && reuse?.sessionId === c.sessionId} icon="split"
                onClick={() => onPick('fork', c)}
              >
                fork
              </ToggleChip>
            </div>
          ))}
          <p className="text-[10.5px] italic text-neutral-600">{REUSE_TRADEOFF_HINT}</p>
        </div>
      )}
    </div>
  );
}
