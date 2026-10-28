import { useState, type ReactNode } from 'react';
import { ChatPanel } from '../components/Chat';
import type { ChatPanelProps } from '../components/chat/chat-panel-props';
import { TerminalsPanel, type TerminalsPanelProps } from '../components/Terminals';
import { takeTerminalRequest } from '../lib/terminal-request';

export interface DesktopLayoutProps {
  chatProps: ChatPanelProps;
  termProps: TerminalsPanelProps;
  center?: ReactNode;
  hideTerminals?: boolean;
  rail?: ReactNode;
  rowRef: React.RefObject<HTMLDivElement | null>;
}

export function DesktopLayout({ chatProps, termProps, center, hideTerminals = false, rail, rowRef }: DesktopLayoutProps) {
  const [terminalOpen, setTerminalOpen] = useState(takeTerminalRequest);
  const open = terminalOpen && !hideTerminals;
  return (
    <div ref={rowRef} className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1">
        {center ?? (
          <div className="min-w-0 flex-1">
            <ChatPanel key={chatProps.session?.id ?? 'none'} {...chatProps} onTerminal={() => setTerminalOpen((o) => !o)} terminalOpen={open} />
          </div>
        )}
      </div>

      {open && (
        <div className="relative w-[min(480px,40%)] min-w-0 shrink-0 border-l border-neutral-800">
          <TerminalsPanel {...termProps} onCloseMobile={() => setTerminalOpen(false)} />
        </div>
      )}

      {rail && <div className="hidden min-[1100px]:flex">{rail}</div>}
    </div>
  );
}
