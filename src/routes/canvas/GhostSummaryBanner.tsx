import { Button, Icon } from '../../components/primitives';
import { relPast } from '../../../shared/format';

interface Props {
  summary: string;
  lastActiveAt: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onDismiss: () => void;
  onContinue: () => void;
  continueEnabled: boolean;
}

// A fixed-height one-line strip, ALWAYS in normal flow — collapsed or
// expanded, it never changes size, so toggling never resizes the terminal
// body beneath it (and so never resizes the tmux pane/pty, which is what an
// xterm.js resize actually does downstream). Expanding reveals the rest
// (time since activity, "continuar daqui") as an ABSOLUTE overlay hanging
// below the strip — it draws over the top of the terminal, never pushes it.
const STRIP_H = 28;

export function GhostSummaryBanner({ summary, lastActiveAt, collapsed, onToggleCollapsed, onDismiss, onContinue, continueEnabled }: Props) {
  const rel = relPast(lastActiveAt);
  const relLabel = rel === 'agora' ? 'ativa agora' : `parada há ${rel}`;
  return (
    <div onPointerDown={(e) => e.stopPropagation()} className="relative shrink-0 border-b border-neutral-800 bg-neutral-900/80" style={{ height: STRIP_H }}>
      <div className="flex h-full items-center gap-1.5 px-2">
        <Icon name="file" size={12} className="shrink-0 text-neutral-500" />
        <p className="flex-1 truncate text-[11px] leading-snug text-neutral-300">{summary}</p>
        <Button variant="ghost" size="sm" square icon={collapsed ? 'chevronDown' : 'chevronUp'} title={collapsed ? 'expandir resumo' : 'recolher resumo'} onClick={onToggleCollapsed} />
        <Button variant="ghost" size="sm" square icon="x" title="dispensar" onClick={onDismiss} />
      </div>
      {!collapsed && (
        <div className="absolute inset-x-0 top-full z-10 border-x border-b border-neutral-800 bg-neutral-900/95 px-2 py-1.5 shadow-lg backdrop-blur-sm">
          <p className="line-clamp-3 text-[11px] leading-snug text-neutral-300">{summary}</p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] text-neutral-600">{relLabel}</span>
            <Button
              variant="secondary" size="sm" icon="arrowUp" disabled={!continueEnabled}
              title={continueEnabled ? undefined : 'sessão retomada num terminal interativo'}
              onClick={onContinue}
            >continuar daqui</Button>
          </div>
        </div>
      )}
    </div>
  );
}
