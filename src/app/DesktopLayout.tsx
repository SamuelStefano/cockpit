import { SessionsPanel, type SessionsPanelProps } from '../components/Sessions';
import { ChatPanel, type ChatPanelProps } from '../components/Chat';
import { TerminalsPanel, type TerminalsPanelProps } from '../components/Terminals';
import { CollapsedRail, CollapseBtn } from '../components/AppChrome';

export interface DesktopLayoutProps {
  sessionsProps: SessionsPanelProps;
  chatProps: ChatPanelProps;
  termProps: TerminalsPanelProps;
  rowRef: React.RefObject<HTMLDivElement>;
  leftW: number;
  rightW: number;
  leftCollapsed: boolean;
  setLeftCollapsed: (v: boolean) => void;
  rightCollapsed: boolean;
  setRightCollapsed: (v: boolean) => void;
  startDrag: (which: string) => (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function DesktopLayout({ sessionsProps, chatProps, termProps, rowRef, leftW, rightW, leftCollapsed, setLeftCollapsed, rightCollapsed, setRightCollapsed, startDrag }: DesktopLayoutProps) {
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
          <div className="resizer w-[3px] shrink-0 cursor-col-resize bg-neutral-800" onMouseDown={startDrag('left')} />
        </>
      )}

      <div className="min-w-0 flex-1">
        <ChatPanel key={chatProps.session?.id ?? 'none'} {...chatProps} />
      </div>

      {rightCollapsed ? (
        <CollapsedRail side="right" label="Terminais" icon="terminal" onExpand={() => setRightCollapsed(false)} />
      ) : (
        <>
          <div className="resizer w-[3px] shrink-0 cursor-col-resize bg-neutral-800" onMouseDown={startDrag('right')} />
          <div style={{ width: `${rightW}%` }} className="relative min-w-0 shrink-0 border-l border-neutral-800">
            <TerminalsPanel {...termProps} />
            <CollapseBtn side="right" onClick={() => setRightCollapsed(true)} />
          </div>
        </>
      )}
    </div>
  );
}
