import { useState } from 'react';
import { isCronPing } from '../../../shared/canvas';
import { relPast } from '../../../shared/format';
import { Icon } from '../../components/primitives';
import type { SessionKanbanItem } from './kanban-items';

interface Props {
  items: SessionKanbanItem[];
  onPick: (nodeId: string) => void;
}

const SHOWN = 6;

// Floating roster of what is alive right now — running first, then waiting on
// you, then the most recent — so a glance at the map answers "who is working".
// `items` is the SAME set CanvasFilters' status line summarizes (sessionItems
// + orchestratorItem, running already folded with cv-live — kanban-items.ts)
// so this roster's own "N rodando" never disagrees with that line's chip.
export function CanvasHud({ items, onPick }: Props) {
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  // Cron reset-pings read like the sidebar always does: never shown here,
  // whatever "mostrar automações" is set to (canvas review, item 1).
  const live = items.filter((i) => !isCronPing({ title: i.title, snippet: i.subtitle }));
  const rank = (i: SessionKanbanItem) => (i.running ? 0 : i.waitingOnUser ? 1 : 2);
  const list = [...live].sort((a, b) => rank(a) - rank(b) || b.mtime - a.mtime);
  const shown = list.slice(0, SHOWN);
  const runningN = live.filter((i) => i.running).length;

  return (
    <div data-canvas-overlay className="absolute right-3 top-3 z-10 w-64 rounded-2xl border border-neutral-700/80 bg-neutral-900/85 shadow-xl backdrop-blur-md">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-left">
        <Icon name="claude" size={14} className="text-orange-400" />
        <span className="flex-1 text-[12.5px] font-semibold text-neutral-100">Sessões</span>
        <span className="font-mono text-[10.5px] text-neutral-500">{runningN} rodando</span>
        <Icon name={open ? 'minimize' : 'maximize'} size={11} className="text-neutral-500" />
      </button>
      {open && (
        <div className="border-t border-neutral-800 px-1.5 py-1.5">
          {shown.map((i) => (
            <button
              key={i.nodeId} type="button" onClick={() => onPick(i.nodeId)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-neutral-800/70"
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${i.running ? 'animate-pulse bg-green-400' : i.waitingOnUser ? 'bg-yellow-400' : 'bg-neutral-600'}`} />
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-neutral-200">{i.title}</span>
              <span className="shrink-0 font-mono text-[10px] text-neutral-500">{i.running ? 'ativo' : i.waitingOnUser ? 'você' : relPast(i.mtime)}</span>
            </button>
          ))}
          {list.length > SHOWN && <div className="px-2 pb-0.5 pt-1 text-[10.5px] text-neutral-500">e mais {list.length - SHOWN}</div>}
        </div>
      )}
    </div>
  );
}
