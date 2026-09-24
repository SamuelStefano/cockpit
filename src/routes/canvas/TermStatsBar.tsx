import type { TermStats } from '../../../shared/canvas';
import { lastSeenLabel } from '../../../shared/format';
import { fmtElapsed, useElapsed } from '../../components/chat/elapsed';
import { cpuHeat, ctxHeat, ctxPct, ctxWindow, fmtMb, fmtTokens, HEAT_TEXT, shortModel } from './term-stats-view';

interface Props {
  stats?: TermStats;
  running: boolean;
  session: boolean;
}

function TurnClock({ startedAt }: { startedAt: number }) {
  const secs = useElapsed(startedAt);
  return <span className="text-green-400">turno {fmtElapsed(secs)}</span>;
}

// Only rendered from the NOT-running branch below (`running && stats.turnStartedAt`
// takes TurnClock instead) — this used to special-case "agora" as "ativa
// agora" anyway, which lied about a window that isn't running. Centralized in
// shared/format.ts (canvas review item 6) so this can't diverge from
// KanbanSessionItem/KanbanItemDrawer's own copy of the same phrase again.
function LastSeen({ at }: { at: number }) {
  return <span>{lastSeenLabel(at)}</span>;
}

// One mono line under the title bar: what the window costs the box right now
// and how much room its conversation has left.
export function TermStatsBar({ stats, running, session }: Props) {
  if (!stats) return <div className="h-6 shrink-0 border-b border-neutral-800/80 bg-neutral-950 px-2.5 font-mono text-[10.5px] leading-6 text-neutral-600">medindo…</div>;
  const pct = ctxPct(stats);
  return (
    <div className="flex h-6 shrink-0 items-center gap-3 overflow-hidden whitespace-nowrap border-b border-neutral-800/80 bg-neutral-950 px-2.5 font-mono text-[10.5px] text-neutral-500">
      <span>cpu <span className={HEAT_TEXT[cpuHeat(stats.cpu)]}>{stats.cpu}%</span></span>
      <span>ram <span className="text-neutral-300">{fmtMb(stats.rssMb)}</span> · {stats.procs}p</span>
      {session && pct !== null && (
        <span className="flex items-center gap-1.5">
          ctx <span className={HEAT_TEXT[ctxHeat(pct)]}>{fmtTokens(stats.contextTokens!)}/{fmtTokens(ctxWindow(stats.contextTokens!, stats.model))}</span>
          <span className="h-1 w-12 overflow-hidden rounded-full bg-neutral-800">
            <span className={`block h-full ${pct >= 80 ? 'bg-red-500' : pct >= 55 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
          </span>
        </span>
      )}
      {session && stats.model && <span className="text-neutral-400">{shortModel(stats.model)}</span>}
      <span className="flex-1" />
      {running && stats.turnStartedAt
        ? <TurnClock startedAt={stats.turnStartedAt} />
        : session && stats.lastAt ? <LastSeen at={stats.lastAt} /> : null}
    </div>
  );
}
