import { useState } from 'react';
import type { Connection } from '../../../shared/connections';
import type { TeamBot } from '../../../shared/protocol';
import { Button, Icon, type IconName } from '../../components/primitives';
import { actionOf, lastUsedLabel, logoOf, STATE_DOT, STATE_TONE, stateLabel, type RowAction } from './connection-view';
import { UsedByStack } from './UsedByStack';

export const ROW_GRID = 'sm:grid sm:grid-cols-[40px_minmax(0,1fr)_140px_120px_120px_124px] sm:items-center sm:gap-x-3';

const KIND_ICON: Partial<Record<Connection['kind'], IconName>> = { machine: 'terminal', device: 'smartphone', key: 'lock' };

interface Props {
  c: Connection;
  bots: TeamBot[];
  now: number;
  onAction: (a: RowAction, c: Connection) => void;
  busy?: boolean;
  canAct?: boolean;
  deviceBadge?: string;
}

export function ConnectionRow({ c, bots, now, onAction, busy, deviceBadge, canAct = true }: Props) {
  const [open, setOpen] = useState(false);
  const action = canAct ? actionOf(c) : null;
  const icon = KIND_ICON[c.kind];
  const logo = logoOf(c.label);
  const showUsedBy = c.kind !== 'device';
  const run = (a: RowAction) => { if (a.kind === 'error') setOpen((v) => !v); else onAction(a, c); };
  return (
    <div id={`conn-${c.id}`} className="border-t border-neutral-800 first:border-t-0">
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 ${ROW_GRID}`}>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold ${icon ? 'bg-neutral-800 text-neutral-300' : logo.tone}`}>
          {icon ? <Icon name={icon} size={16} /> : logo.text}
        </span>
        <span className="min-w-0 flex-1 sm:flex-none">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-medium text-neutral-100">{c.label}</span>
            {deviceBadge && <span className="rounded border border-neutral-700 bg-neutral-800 px-1.5 text-[10.5px] text-neutral-300">{deviceBadge}</span>}
          </span>
          {c.detail && !open && <small className="block truncate text-[12px] text-neutral-500">{c.detail}</small>}
        </span>
        <span aria-hidden className="basis-full sm:hidden" />
        <span className={`flex items-center gap-1.5 text-[12.5px] ${STATE_TONE[c.state]}`}>
          <span aria-hidden className={`h-[7px] w-[7px] rounded-full ${STATE_DOT[c.state]}`} />
          {stateLabel(c)}
        </span>
        <span className="text-[12.5px] text-neutral-500">{lastUsedLabel(c.lastUsed, now)}</span>
        <span className="min-w-0">{showUsedBy && <UsedByStack ids={c.usedBy ?? []} bots={bots} />}</span>
        <span className="ml-auto flex justify-end sm:ml-0">
          {action ? (
            <Button size="sm" variant={action.primary ? 'primary' : 'ghost'} disabled={busy} onClick={() => run(action)}>{action.label}</Button>
          ) : c.detail ? (
            <button type="button" aria-label="Detalhes" aria-expanded={open} onClick={() => setOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100">
              <Icon name="ellipsis" size={16} />
            </button>
          ) : null}
        </span>
      </div>
      {open && c.detail && (
        <div className="mx-4 mb-3 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[12px] text-neutral-400">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">Detalhes</p>
          <p className="break-words">{c.detail}</p>
          {action?.kind === 'error' && (
            <Button size="sm" variant="secondary" icon="rotate" className="mt-2" disabled={busy} onClick={() => onAction({ ...action, kind: 'relogin', label: 'Tentar de novo' }, c)}>Tentar de novo</Button>
          )}
        </div>
      )}
    </div>
  );
}
