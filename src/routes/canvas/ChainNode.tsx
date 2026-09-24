import { memo } from 'react';
import type { TermStats } from '../../../shared/canvas';
import { AREA_LABELS } from '../../../shared/canvas';
import { Badge, Button, Icon } from '../../components/primitives';
import { relPast } from '../../../shared/format';
import { ctxHeat, ctxPct, HEAT_TEXT } from './term-stats-view';
import type { ChainItem } from './chain-layout';

interface Props {
  item: ChainItem;
  running: boolean;
  waiting: boolean;
  stats?: TermStats;
  descendantCount: number;
  collapsed: boolean;
  runningCount: number; // area/orchestrator kind only — count of RUNNING descendants
  onToggleCollapse?: () => void;
  onOpenTerm?: () => void;
  onOpenChat?: () => void;
}

function StateDot({ running, waiting, archived }: { running: boolean; waiting: boolean; archived?: boolean }) {
  if (running) return <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-green-400" title="rodando" />;
  if (waiting) return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400" title="esperando você" />;
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${archived ? 'bg-neutral-700' : 'bg-neutral-500'}`} title={archived ? 'arquivada' : 'idle'} />;
}

// One card for the org-chart view — same visual language as CanvasNodeCard
// (fuchsia = orchestrator, status dot, ctx bar) at a compact, uniform
// footprint per kind (chain-layout.ts's CHAIN_ROOT_H/CHAIN_AREA_H/
// CHAIN_SESSION_H) so a column reads as one tight list, not cards with dead
// space inside them (review #609 point 3).
export const ChainNode = memo(function ChainNode({ item, running, waiting, stats, descendantCount, collapsed, runningCount, onToggleCollapse, onOpenTerm, onOpenChat }: Props) {
  const pct = stats ? ctxPct(stats) : null;

  if (item.kind === 'orchestrator') {
    return (
      <div className="flex h-full w-full items-center gap-1.5 rounded-lg border border-fuchsia-500 bg-neutral-900/95 px-2.5 shadow-[0_0_16px_-4px_rgba(217,70,239,0.6)]">
        <Icon name="command" size={13} className="shrink-0 text-fuchsia-400" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-fuchsia-100">{item.node?.title ?? 'Orchestrator'}</span>
        <Badge tone="purple" className="shrink-0">ORCHESTRATOR</Badge>
      </div>
    );
  }

  if (item.kind === 'area') {
    const label = item.areaId ? AREA_LABELS[item.areaId] : '';
    return (
      <button
        type="button" onClick={onToggleCollapse}
        className="flex h-full w-full items-center gap-1.5 rounded-lg border border-orange-500/50 bg-orange-500/10 px-2.5 text-left hover:border-orange-500/70"
      >
        <Icon name="layers" size={12} className="shrink-0 text-orange-400" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-orange-200">{label}</span>
        <Badge tone="orange" className="shrink-0">{descendantCount}</Badge>
        {runningCount > 0 && (
          <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-green-400" title={`${runningCount} rodando`}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />{runningCount}
          </span>
        )}
        <Icon name={collapsed ? 'chevronRight' : 'chevronDown'} size={13} className="shrink-0 text-orange-400/70" />
      </button>
    );
  }

  // session
  const n = item.node!;
  return (
    <div
      onClick={onOpenTerm}
      className={`flex h-full w-full cursor-pointer flex-col justify-center gap-1 rounded-lg border bg-neutral-900/95 px-2 py-1.5 hover:border-orange-500/40
        ${n.archived ? 'border-neutral-800 opacity-60' : 'border-neutral-700/80'}`}
    >
      <div className="flex items-center gap-1.5">
        <StateDot running={running} waiting={waiting} archived={n.archived} />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-neutral-100">{n.title}</span>
        {item.arrivedVia === 'fork' && <Icon name="split" size={10} className="shrink-0 text-neutral-500" />}
        {item.arrivedVia === 'flow' && <Icon name="zap" size={10} className="shrink-0 text-neutral-500" />}
        <span className="shrink-0 font-mono text-[9px] text-neutral-600">{relPast(n.mtime)}</span>
        {collapsed && descendantCount > 0 && <Badge className="shrink-0">{descendantCount}</Badge>}
        {item.children.length > 0 && (
          <span onClick={(e) => e.stopPropagation()} className="-mr-1 shrink-0">
            <Button variant="ghost" size="xs" square icon={collapsed ? 'chevronRight' : 'chevronDown'} title={collapsed ? 'expandir' : 'recolher'} onClick={onToggleCollapse} />
          </span>
        )}
        <span onClick={(e) => e.stopPropagation()} className="-mr-1 shrink-0">
          <Button variant="ghost" size="xs" square icon="message" title="abrir chat" onClick={onOpenChat} />
        </span>
      </div>
      {pct !== null && (
        <div className="h-[3px] w-full shrink-0 overflow-hidden rounded-full bg-neutral-800">
          <div className={`h-full rounded-full ${HEAT_TEXT[ctxHeat(pct)].replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} title={`${pct}% do contexto`} />
        </div>
      )}
    </div>
  );
});
