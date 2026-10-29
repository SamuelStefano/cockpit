import { useState } from 'react';
import { Popover, Tooltip, UsageRing, type PopoverSide, type TooltipSide } from '../../primitives';
import type { PlanUsage, SysStats } from '../../../../shared/protocol';
import { relReset } from '../../../lib/time';
import { usageRows } from '../usage-rows';
import { usageChip, type UsageAgent, type UsageReading } from '../usage-agent';
import { UsagePanel } from '../UsagePanel';
import { useOpenRefresh } from '../useUsagePanel';
import { usageSummary } from './usage-summary';
import { VpsMeters } from './VpsMeters';
import { paceOf } from '../../../lib/gamify/pace';

export interface UsageDockProps {
  usageAgent?: UsageAgent;
  planUsage: PlanUsage | null;
  planBlockedUntil?: number | null;
  planReadAt?: number | null;
  planNextReadAt?: number | null;
  onRefreshPlanUsage?: (force?: boolean) => void;
  grokUsage?: UsageReading;
  onRefreshGrokUsage?: (force?: boolean) => void;
  quotaWarn?: boolean;
  quotaPaused?: boolean;
  quotaResetsAt?: number | null;
  stats: SysStats | null;
}

interface Placement { side: PopoverSide; tip: TooltipSide; size: number; box: string }

const HEADER: Placement = { side: 'bottom', tip: 'bottom', size: 20, box: 'h-8 w-8 pointer-coarse:h-11 pointer-coarse:w-11' };

// The plan-usage ring, in the chat header: no number on screen, the reading is in the hover label and
// the click opens the full panel plus the VPS meters (the old StatusBar).
export function readUsage({ usageAgent = 'claude', planUsage, planBlockedUntil = null, planReadAt = null, planNextReadAt = null, grokUsage, quotaWarn = false, quotaPaused = false, quotaResetsAt = null }: UsageDockProps) {
  const chip = usageChip(usageAgent, { usage: planUsage, blockedUntil: planBlockedUntil, readAt: planReadAt, nextReadAt: planNextReadAt }, grokUsage);
  const warn = chip.gate && quotaWarn;
  const paused = chip.gate && quotaPaused;
  const gateResetAt = chip.gate ? quotaResetsAt : null;
  const s = usageSummary({ usage: chip.usage, agent: chip.agent, readAt: chip.readAt, warn, paused, quotaResetsAt: gateResetAt });
  return { chip, warn, paused, gateResetAt, s };
}

export function UsageDock(props: UsageDockProps) {
  const { onRefreshPlanUsage, onRefreshGrokUsage, stats } = props;
  const [open, setOpen] = useState(false);
  const { chip, warn, paused, gateResetAt, s } = readUsage(props);
  useOpenRefresh(open, chip.agent === 'grok' ? onRefreshGrokUsage : onRefreshPlanUsage);
  const p = HEADER;
  const pace = chip.agent === 'grok' ? null : paceOf(chip.usage, Date.now());
  const title = chip.agent === 'grok' ? 'Uso do Grok' : 'Uso do plano';

  return (
    <Popover
      open={open} onClose={() => setOpen(false)} label={`${title} e VPS`} side={p.side} align="end"
      content={
        <>
          {pace && <p className="px-3 pt-2 text-[12px] text-neutral-400">Semana: {pace.sentence}</p>}
          <UsagePanel inline rows={usageRows(chip.usage)} reset={gateResetAt ? relReset(gateResetAt) : ''} warn={warn || paused} blockedUntil={chip.blockedUntil} readAt={chip.readAt} nextReadAt={chip.nextReadAt} title={title} secondary={chip.secondary} />
          <VpsMeters stats={stats} />
        </>
      }
    >
      <Tooltip label={s.tip} side={p.tip} disabled={open}>
        <button
          type="button" onClick={() => setOpen((o) => !o)} aria-label={s.aria} aria-expanded={open} aria-haspopup="dialog"
          className={`relative flex ${p.box} items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-800/70 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40`}
        >
          <UsageRing value={s.pct} tone={s.tone} size={p.size} label={s.aria} tick={pace?.ideal ?? null} />
          {(paused || warn) && <span aria-hidden="true" className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-neutral-950 ${paused ? 'animate-pulse bg-red-400' : 'bg-amber-400'}`} />}
        </button>
      </Tooltip>
    </Popover>
  );
}
