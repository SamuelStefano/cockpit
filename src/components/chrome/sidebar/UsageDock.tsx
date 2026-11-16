import { useState } from 'react';
import { Popover, Tooltip, UsageRing, type PopoverSide, type TooltipSide } from '../../primitives';
import { Sheet } from '../../primitives/Sheet';
import type { CapacityInfo, PlanUsage, SysStats } from '../../../../shared/protocol';
import { relReset } from '../../../lib/time';
import { usageRows } from '../usage-rows';
import { usageChip, type UsageAgent, type UsageReading } from '../usage-agent';
import { UsagePanel } from '../UsagePanel';
import { useOpenRefresh } from '../useUsagePanel';
import { usageSummary } from './usage-summary';
import { VpsMeters } from './VpsMeters';
import { capacityLabel } from '../../../lib/capacity';

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
  capacity?: CapacityInfo | null;
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

const titleOf = (agent: string) => (agent === 'grok' ? 'Uso do Grok' : 'Uso do plano');

// Every limit with its reset (session, week, per model) plus the VPS meters.
function UsageDetail(props: UsageDockProps) {
  const { chip, warn, paused, gateResetAt } = readUsage(props);
  return (
    <>
      <UsagePanel inline rows={usageRows(chip.usage)} reset={gateResetAt ? relReset(gateResetAt) : ''} warn={warn || paused} blockedUntil={chip.blockedUntil} readAt={chip.readAt} nextReadAt={chip.nextReadAt} title={titleOf(chip.agent)} secondary={chip.secondary} />
      <VpsMeters stats={props.stats} />
      {props.capacity && (
        <p className="flex items-center justify-between border-t border-neutral-800 px-3.5 py-2.5 text-[12px] text-neutral-400">
          <span>Conversas rodando</span>
          <span className="tabular-nums text-neutral-300">{capacityLabel(props.capacity)}</span>
        </p>
      )}
    </>
  );
}

// Phone: the header has no ring, so the "…" menu row opens the same detail as a bottom sheet.
export function UsageSheet({ open, onClose, ...props }: UsageDockProps & { open: boolean; onClose: () => void }) {
  const { chip } = readUsage(props);
  useOpenRefresh(open, chip.agent === 'grok' ? props.onRefreshGrokUsage : props.onRefreshPlanUsage);
  if (!open) return null;
  return (
    <Sheet open onClose={onClose} label={`${titleOf(chip.agent)} e VPS`} align="end" content={<div className="[&>div]:w-full"><UsageDetail {...props} /></div>}>
      <span />
    </Sheet>
  );
}

export function UsageDock(props: UsageDockProps) {
  const { onRefreshPlanUsage, onRefreshGrokUsage } = props;
  const [open, setOpen] = useState(false);
  const { chip, warn, paused, s } = readUsage(props);
  useOpenRefresh(open, chip.agent === 'grok' ? onRefreshGrokUsage : onRefreshPlanUsage);
  const p = HEADER;

  return (
    <span className="flex items-center">
    <Popover
      open={open} onClose={() => setOpen(false)} label={`${titleOf(chip.agent)} e VPS`} side={p.side} align="end"
      content={<UsageDetail {...props} />}
    >
      <Tooltip label={s.tip} side={p.tip} disabled={open}>
        <button
          type="button" onClick={() => setOpen((o) => !o)} aria-label={s.aria} aria-expanded={open} aria-haspopup="dialog"
          className={`relative flex ${p.box} items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-800/70 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40`}
        >
          <UsageRing value={s.pct} tone={s.tone} size={p.size} label={s.aria} />
          {(paused || warn) && <span aria-hidden="true" className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-neutral-950 ${paused ? 'animate-pulse bg-red-400' : 'bg-amber-400'}`} />}
        </button>
      </Tooltip>
    </Popover>
    </span>
  );
}
