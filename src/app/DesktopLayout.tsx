import { SessionsPanel, type SessionsPanelProps } from '../components/Sessions';
import { ChatPanel } from '../components/Chat';
import type { ChatPanelProps } from '../components/chat/chat-panel-props';
import { TerminalsPanel, type TerminalsPanelProps } from '../components/Terminals';
import { CollapsedRail } from '../components/chrome/CollapsedRail';
import { CollapseBtn } from '../components/chrome/CollapseBtn';
import { LEFT_RANGE, RIGHT_RANGE, type PanelSide } from './usePanelResize';

export interface DesktopLayoutProps {
  sessionsProps: SessionsPanelProps;
  chatProps: ChatPanelProps;
  termProps: TerminalsPanelProps;
  rowRef: React.RefObject<HTMLDivElement | null>;
  leftW: number;
  rightW: number;
  leftCollapsed: boolean;
  setLeftCollapsed: (v: boolean) => void;
  rightCollapsed: boolean;
  setRightCollapsed: (v: boolean) => void;
  startDrag: (which: PanelSide) => (e: React.PointerEvent<HTMLDivElement>) => void;
  nudge: (which: PanelSide, e: React.KeyboardEvent) => void;
}

export function DesktopLayout({ sessionsProps, chatProps, termProps, rowRef, leftW, rightW, leftCollapsed, setLeftCollapsed, rightCollapsed, setRightCollapsed, startDrag, nudge }: DesktopLayoutProps) {
  return (
    <div ref={rowRef} className="flex min-h-0 flex-1">
      {leftCollapsed ? (
        <CollapsedRail side="left" label="Sessões" icon="message" onExpand={() => setLeftCollapsed(false)} />
      ) : (
        <>
          <div style={{ width: `${leftW}%` }} className="relative min-w-0 shrink-0 border-r border-neutral-800">
            <SessionsPanel {...sessionsProps} />
            <CollapseBtn side="left" onClick={() => setLeftCollapsed(true)} />
          </div>
          <div
            role="separator" aria-orientation="vertical" aria-label="Largura do painel de sessões" tabIndex={0}
            aria-valuenow={Math.round(leftW)} aria-valuemin={LEFT_RANGE[0]} aria-valuemax={LEFT_RANGE[1]}
            className="resizer w-[3px] shrink-0 cursor-col-resize touch-none bg-neutral-800 focus-visible:bg-orange-500/60 focus-visible:outline-hidden"
            onPointerDown={startDrag('left')} onKeyDown={(e) => nudge('left', e)}
          />
        </>
      )}

      <div className="min-w-0 flex-1">
        <ChatPanel key={chatProps.session?.id ?? 'none'} {...chatProps} />
      </div>

      {rightCollapsed ? (
        <CollapsedRail side="right" label="Terminais" icon="terminal" onExpand={() => setRightCollapsed(false)} />
      ) : (
        <>
          <div
            role="separator" aria-orientation="vertical" aria-label="Largura do painel de terminais" tabIndex={0}
            aria-valuenow={Math.round(rightW)} aria-valuemin={RIGHT_RANGE[0]} aria-valuemax={RIGHT_RANGE[1]}
            className="resizer w-[3px] shrink-0 cursor-col-resize touch-none bg-neutral-800 focus-visible:bg-orange-500/60 focus-visible:outline-hidden"
            onPointerDown={startDrag('right')} onKeyDown={(e) => nudge('right', e)}
          />
          <div style={{ width: `${rightW}%` }} className="relative min-w-0 shrink-0 border-l border-neutral-800">
            <TerminalsPanel {...termProps} />
            <CollapseBtn side="right" onClick={() => setRightCollapsed(true)} />
          </div>
        </>
      )}
    </div>
  );
}
