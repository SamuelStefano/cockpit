import type { ReactNode } from 'react';
import { ChatPanel } from '../components/Chat';
import type { ChatPanelProps } from '../components/chat/chat-panel-props';
import { TerminalsPanel, type TerminalsPanelProps } from '../components/Terminals';
import { CollapsedRail } from '../components/chrome/CollapsedRail';
import { CollapseBtn } from '../components/chrome/CollapseBtn';
import { RIGHT_RANGE, type PanelSide } from './usePanelResize';

export interface DesktopLayoutProps {
  chatProps: ChatPanelProps;
  termProps: TerminalsPanelProps;
  // An agent's thread takes the chat's place; when it shows its profile, the
  // profile owns the right side and the terminals step aside.
  center?: ReactNode;
  hideTerminals?: boolean;
  rowRef: React.RefObject<HTMLDivElement | null>;
  rightW: number;
  rightCollapsed: boolean;
  setRightCollapsed: (v: boolean) => void;
  startDrag: (which: PanelSide) => (e: React.PointerEvent<HTMLDivElement>) => void;
  nudge: (which: PanelSide, e: React.KeyboardEvent) => void;
}

// The conversations list lives in the left sidebar now: the row is the open
// thread plus the terminals.
export function DesktopLayout({ chatProps, termProps, center, hideTerminals = false, rowRef, rightW, rightCollapsed, setRightCollapsed, startDrag, nudge }: DesktopLayoutProps) {
  return (
    <div ref={rowRef} className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1">
        {center ?? <div className="min-w-0 flex-1"><ChatPanel key={chatProps.session?.id ?? 'none'} {...chatProps} /></div>}
      </div>

      {hideTerminals ? null : rightCollapsed ? (
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
