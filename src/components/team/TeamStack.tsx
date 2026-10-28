import { useState } from 'react';
import { Sheet } from '../primitives/Sheet';
import type { BotView } from '../../routes/equipe/team-view';
import { Mascot } from './Mascot';
import { TeamSheet, type TeamSheetProps } from './TeamSheet';
import { orderTeam, waitingCount } from './team-order';

const SHOWN = 3;

export type TeamStackProps = Omit<TeamSheetProps, 'entries' | 'onClose' | 'working'>;

// Header chip for windows without the rail: 3 overlapping mascots, "+N", an orange
// dot when someone waits on you. Opens the team sheet (bottom sheet on touch, popover on desktop).
export function TeamStack(props: TeamStackProps) {
  const [open, setOpen] = useState(false);
  const { views } = props;
  if (views.length === 0) return null;
  const entries = orderTeam(views);
  const extra = views.length - SHOWN;
  const waiting = waitingCount(views);
  const working = views.filter((v: BotView) => v.state === 'thinking' || v.state === 'working').length;
  return (
    <span className="min-[1100px]:hidden">
      <Sheet
        open={open} onClose={() => setOpen(false)} label="Equipe" side="bottom" align="end" className="w-80"
        content={<TeamSheet {...props} entries={entries} working={working} onClose={() => setOpen(false)} />}
      >
        <button
          type="button" onClick={() => setOpen((o) => !o)} aria-label={waiting ? `Equipe, ${waiting} esperando você` : 'Equipe'} aria-haspopup="dialog" aria-expanded={open}
          className="relative flex h-9 items-center gap-1 rounded-lg px-1.5 hover:bg-neutral-800/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40 pointer-coarse:h-11"
        >
          <span className="flex items-center">
            {entries.slice(0, SHOWN).map(({ view }, i) => (
              <span key={view.bot.id} className={`rounded-full ring-2 ring-neutral-900 ${i ? '-ml-1.5' : ''}`}>
                <Mascot mascot={view.bot.mascot} state={view.state} size={24} />
              </span>
            ))}
          </span>
          {extra > 0 && <span className="text-[12px] text-neutral-400">+{extra}</span>}
          {waiting > 0 && <span aria-hidden className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-neutral-900" />}
        </button>
      </Sheet>
    </span>
  );
}
