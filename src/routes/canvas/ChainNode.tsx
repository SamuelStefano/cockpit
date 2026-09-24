import { memo } from 'react';
import type { TermStats } from '../../../shared/canvas';
import { AREA_LABELS } from '../../../shared/canvas';
import { Badge, Button, Icon } from '../../components/primitives';
import { relPast } from '../../../shared/format';
import { STATUS_LABEL, STATUS_TONE } from './canvas-labels';
import { ctxHeat, ctxPct, fmtTokens, HEAT_TEXT } from './term-stats-view';
import type { ChainItem } from './chain-layout';

interface Props {
  item: ChainItem;
  running: boolean;
  waiting: boolean;
  stats?: TermStats;
  descendantCount: number;
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onOpenTerm?: () => void;
  onOpenChat?: () => void;
}

function StateDot({ running, waiting, archived }: { running: boolean; waiting: boolean; archived?: boolean }) {
  if (running) return <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-400" title="rodando" />;
  if (waiting) return <span className="h-2 w-2 shrink-0 rounded-full bg-yellow-400" title="esperando você" />;
  return <span className={`h-2 w-2 shrink-0 rounded-full ${archived ? 'bg-neutral-700' : 'bg-neutral-500'}`} title={archived ? 'arquivada' : 'idle'} />;
}

// One card for the org-chart view — same visual language as CanvasNodeCard
// (fuchsia = orchestrator, status dot, ctx bar) at a smaller, uniform footprint
// so a wide tree still reads as one system rather than a second card design.
export const ChainNode = memo(function ChainNode({ item, running, waiting, stats, descendantCount, collapsed, onToggleCollapse, onOpenTerm, onOpenChat }: Props) {
  const pct = stats ? ctxPct(stats) : null;

  if (item.kind === 'orchestrator') {
    return (
      <div className="flex h-full w-full flex-col justify-center rounded-xl border border-fuchsia-500 bg-neutral-900/95 px-3 py-2 shadow-[0_0_20px_-4px_rgba(217,70,239,0.6)]">
        <div className="flex items-center gap-1.5">
          <Icon name="command" size={13} className="text-fuchsia-400" />
          <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-fuchsia-100">{item.node?.title ?? 'Orchestrator'}</span>
        </div>
        <Badge tone="purple" className="mt-1 w-fit">ORCHESTRATOR</Badge>
      </div>
    );
  }

  if (item.kind === 'area') {
    const label = item.areaId ? AREA_LABELS[item.areaId] : '';
    return (
      <button
        type="button" onClick={onToggleCollapse}
        className="flex h-full w-full items-center gap-1.5 rounded-xl border border-orange-500/50 bg-orange-500/10 px-3 py-2 text-left hover:border-orange-500/70"
      >
        <Icon name="layers" size={13} className="text-orange-400" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-orange-200">{label}</span>
        <Badge tone="orange">{descendantCount}</Badge>
        <Icon name={collapsed ? 'chevronRight' : 'chevronDown'} size={13} className="shrink-0 text-orange-400/70" />
      </button>
    );
  }

  // session
  const n = item.node!;
  return (
    <div
      onClick={onOpenTerm}
      className={`flex h-full w-full cursor-pointer flex-col justify-between rounded-xl border bg-neutral-900/95 px-2.5 py-1.5 shadow-lg shadow-black/40 hover:border-orange-500/40
        ${n.archived ? 'border-neutral-800 opacity-60' : 'border-neutral-700/80'}`}
    >
      <div className="flex items-center gap-1.5">
        <StateDot running={running} waiting={waiting} archived={n.archived} />
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-neutral-100">{n.title}</span>
        {collapsed && descendantCount > 0 && <Badge>{descendantCount}</Badge>}
        <span onClick={(e) => e.stopPropagation()} className="flex items-center">
          <Button variant="ghost" size="xs" square icon="message" title="abrir chat" onClick={onOpenChat} />
          {item.children.length > 0 && (
            <Button variant="ghost" size="xs" square icon={collapsed ? 'chevronRight' : 'chevronDown'} title={collapsed ? 'expandir' : 'recolher'} onClick={onToggleCollapse} />
          )}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1 font-mono text-[9px] text-neutral-600">
        {item.arrivedVia === 'fork' && <Badge tone="neutral"><Icon name="split" size={9} />fork</Badge>}
        {item.arrivedVia === 'flow' && <Badge tone="neutral"><Icon name="zap" size={9} />flow</Badge>}
        {n.status && <Badge tone={STATUS_TONE[n.status]}>{STATUS_LABEL[n.status]}</Badge>}
        <span className="flex-1" />
        <span>{relPast(n.mtime)}</span>
      </div>
      {pct !== null && (
        <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-neutral-800">
          <div className={`h-full rounded-full ${HEAT_TEXT[ctxHeat(pct)].replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} title={`${fmtTokens(stats!.contextTokens!)} · ${pct}%`} />
        </div>
      )}
    </div>
  );
});
