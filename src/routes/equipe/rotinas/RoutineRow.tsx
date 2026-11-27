import { useState } from 'react';
import type { Cron, TeamBot } from '../../../../shared/protocol';
import { Button, Menu, MenuItem, Popover, toast, tokens } from '../../../components/primitives';
import { useArmed } from '../../../components/primitives/useArmed';
import { Mascot } from '../../../components/team/Mascot';
import { botOf, failed, lastRunState, routineSub, whenLabel } from './routine-view';

interface RoutineRowProps {
  routine: Cron;
  bots: TeamBot[];
  now: number;
  compact?: boolean;
  onToggle: () => void;
  onRun: () => void;
  onEdit: () => void;
  onChat: (botId: string) => void;
  onDelete: () => void;
}

const TONE = { ok: 'bg-emerald-400', err: 'bg-red-400', muted: 'bg-neutral-600' };
const TEXT = { ok: 'text-neutral-400', err: 'text-red-400', muted: 'text-neutral-500' };

export function RoutineRow({ routine, bots, now, compact = false, onToggle, onRun, onEdit, onChat, onDelete }: RoutineRowProps) {
  const [open, setOpen] = useState(false);
  const del = useArmed();
  const bot = botOf(routine, bots);
  const state = lastRunState(routine, now);
  const run = () => { onRun(); toast('Rotina disparada'); setOpen(false); };
  const sub = compact ? routine.prompt.replace(/\s+/g, ' ').trim() : routineSub(routine, bots);
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-neutral-800/70 px-4 py-3 last:border-b-0 md:grid-cols-[auto_minmax(0,1fr)_170px_160px_auto]">
      <button
        type="button" role="switch" aria-checked={routine.enabled} aria-label={routine.name} onClick={onToggle}
        className={`relative h-4.5 w-8 shrink-0 rounded-full transition ${tokens.focusRing} ${routine.enabled ? 'bg-orange-500' : 'bg-neutral-700'}`}
      >
        <span className={`absolute top-0.75 h-3 w-3 rounded-full bg-white transition-all ${routine.enabled ? 'left-4.5' : 'left-0.75'}`} />
      </button>
      <div className="flex min-w-0 items-center gap-2.5">
        {!compact && (bot ? <Mascot mascot={bot.mascot} size={24} /> : <span className="h-6 w-6 shrink-0 rounded-full bg-neutral-800" />)}
        <div className="min-w-0">
          <span className="block truncate text-[14px] font-medium text-neutral-100">{routine.name}</span>
          <span className="block truncate text-[12px] text-neutral-500" title={routine.prompt}>{sub}</span>
        </div>
      </div>
      <div className="col-start-1 col-end-4 flex flex-wrap items-center gap-x-4 gap-y-0.5 pl-11 text-[13px] md:contents">
        <span className="text-neutral-400 md:col-auto">{whenLabel(routine)}{!routine.enabled && ' · pausada'}</span>
        <span className={`flex items-center gap-1.5 ${TEXT[state.tone]}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE[state.tone]}`} />
          <span>{state.text}</span>
        </span>
      </div>
      <div className="col-start-3 row-start-1 flex items-center gap-1 md:col-start-5">
        {compact && <Button variant="ghost" size="sm" onClick={run} className="hidden sm:inline-flex">{failed(routine) ? 'Rodar de novo' : 'Rodar agora'}</Button>}
        <Popover
          open={open} onClose={() => setOpen(false)} label={`Ações de ${routine.name}`} side="bottom" align="end"
          content={
            <Menu label={`Ações de ${routine.name}`}>
              <MenuItem icon="play" label="Rodar agora" onClick={run} />
              {routine.botId && <MenuItem icon="pencil" label="Editar" onClick={() => { setOpen(false); onEdit(); }} />}
              {bot && <MenuItem icon="message" label="Ver conversa" onClick={() => { setOpen(false); onChat(bot.id); }} />}
              <MenuItem icon="trash" danger label={del.armed ? 'Apagar mesmo?' : 'Apagar'} onClick={() => del.fire(() => { setOpen(false); onDelete(); })} />
            </Menu>
          }
        >
          <Button variant="ghost" size="sm" square icon="ellipsis" aria-label={`Mais ações de ${routine.name}`} aria-haspopup="menu" aria-expanded={open}
            className={tokens.touchBox} onClick={() => setOpen((o) => !o)} />
        </Popover>
      </div>
    </div>
  );
}
