import { Button } from '../primitives';
import type { SetupChecklist } from '../../cockpit/setup-watch';
import { LevelIcon } from './LevelIcon';
import { HealthHint } from './HealthHint';
import { HealthItemRow } from './HealthItemRow';

const TITLE_TONE = { waiting: 'text-neutral-200', progress: 'text-neutral-200', switch: 'text-orange-300', ready: 'text-green-300', failed: 'text-red-300' } as const;

interface Props {
  c: SetupChecklist;
  onSwitch?: () => void;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function SetupChecklistView({ c, onSwitch, onRetry, onDismiss }: Props) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3" aria-live="polite">
      <p className={`text-[13px] font-medium ${TITLE_TONE[c.phase]}`}>{c.title}</p>
      <ol className="mt-2 space-y-1.5">
        {c.steps.map((s) => (
          <li key={s.id} className="flex items-start gap-2">
            <LevelIcon state={s.state} />
            <div className="min-w-0 flex-1">
              <p className={`text-[12.5px] ${s.state === 'pending' ? 'text-neutral-500' : 'text-neutral-200'}`}>{s.label}</p>
              {s.hint && <HealthHint text={s.hint} />}
            </div>
          </li>
        ))}
      </ol>
      {c.problems.length > 0 && (
        <ul className="mt-2 border-t border-neutral-800 pt-1">
          {c.problems.map((i) => <HealthItemRow key={i.id} item={i} />)}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {c.phase === 'switch' && onSwitch && <Button size="sm" icon="swap" onClick={onSwitch}>Abrir e testar</Button>}
        {c.phase === 'failed' && onRetry && c.steps[2]?.state === 'ok' && <Button size="sm" variant="outline" icon="rotate" onClick={onRetry}>Testar de novo</Button>}
        {onDismiss && <Button size="sm" variant="ghost" onClick={onDismiss}>{c.phase === 'ready' ? 'Fechar' : 'Ocultar'}</Button>}
      </div>
    </div>
  );
}
