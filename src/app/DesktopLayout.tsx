import { useEffect, useState, type ReactNode } from 'react';
import { ChatPanel } from '../components/Chat';
import { ChatWithFilePanel } from '../components/chat/file-panel/ChatWithFilePanel';
import type { ChatPanelProps } from '../components/chat/chat-panel-props';
import { TerminalsPanel, type TerminalsPanelProps } from '../components/Terminals';
import { takeTerminalRequest, TERMINAL_TOGGLE_EVENT } from '../lib/terminal-request';

export interface DesktopLayoutProps {
  chatProps: ChatPanelProps;
  termProps: TerminalsPanelProps;
  center?: ReactNode;
  hideTerminals?: boolean;
  rowRef: React.RefObject<HTMLDivElement | null>;
}

export function DesktopLayout({ chatProps, termProps, center, hideTerminals = false, rowRef }: DesktopLayoutProps) {
  const [terminalOpen, setTerminalOpen] = useState(takeTerminalRequest);
  useEffect(() => {
    const toggle = () => setTerminalOpen((o) => !o);
    window.addEventListener(TERMINAL_TOGGLE_EVENT, toggle);
    return () => window.removeEventListener(TERMINAL_TOGGLE_EVENT, toggle);
  }, []);
  const open = terminalOpen && !hideTerminals;
  return (
    <div ref={rowRef} className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1">
        {center ?? (
          <div className="min-w-0 flex-1">
            <ChatWithFilePanel sessionId={chatProps.session?.id} files={chatProps.sessionFiles} isMobile={false}>
              <ChatPanel key={chatProps.session?.id ?? 'none'} {...chatProps} onTerminal={() => setTerminalOpen((o) => !o)} terminalOpen={open} />
            </ChatWithFilePanel>
          </div>
        )}
      </div>

      {open && (
        <div className="relative w-[min(500px,40%)] min-w-0 shrink-0 border-l border-(--border) bg-neutral-950">
          <TerminalsPanel {...termProps} onCloseMobile={() => setTerminalOpen(false)} />
        </div>
      )}

    </div>
  );
}
