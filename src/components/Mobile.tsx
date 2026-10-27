import { useState, useRef, type ReactNode } from 'react';
import { MobileDrawer } from './MobileDrawer';
import { ChatPanel } from './Chat';
import type { ChatPanelProps } from './chat/chat-panel-props';
import { TerminalsPanel, type TerminalsPanelProps } from './Terminals';
import type { Terminal } from '../data/types';
import { useEscapeLayer } from './primitives/useEscapeLayer';

interface TerminalSheetProps {
  termProps: TerminalsPanelProps;
  onClose: () => void;
}

function TerminalSheet({ termProps, onClose }: TerminalSheetProps) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => { startY.current = e.touches[0].clientY; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 90) onClose();
    else setDragY(0);
    startY.current = null;
  };

  return (
    <div className="absolute inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" style={{ animation: 'overlayIn 0.2s ease' }} onClick={onClose} />
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-2xl border-t border-neutral-700 shadow-2xl"
        style={{
          height: '72%',
          background: 'var(--term-bg)',
          transform: `translateY(${dragY}px)`,
          animation: dragY === 0 ? 'sheetUp 0.3s cubic-bezier(0.22,1,0.36,1)' : 'none',
          transition: startY.current == null ? 'transform 0.2s ease' : 'none',
        }}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none flex-col items-center pt-2.5"
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        >
          <div className="h-1 w-10 rounded-full bg-neutral-700" />
        </div>
        <div className="min-h-0 flex-1">
          <TerminalsPanel {...termProps} onCloseMobile={onClose} />
        </div>
      </div>
    </div>
  );
}

export interface MobileLayoutProps {
  chatProps: ChatPanelProps;
  termProps: TerminalsPanelProps;
  drawer: boolean;
  setDrawer: (v: boolean) => void;
  termSheet: boolean;
  setTermSheet: (v: boolean) => void;
  runningTerm: Terminal | undefined;
  // The drawer's content: the sidebar itself, in drawer mode.
  drawerNav?: ReactNode;
  // An agent's thread, full screen in place of the plain chat.
  center?: ReactNode;
}

export function MobileLayout({ chatProps, termProps, drawer, setDrawer, termSheet, setTermSheet, runningTerm, drawerNav, center }: MobileLayoutProps) {
  // Hardware keyboard (iPad, Bluetooth phone): Esc closes these two overlays too.
  // They are escape layers so a dialog opened on top of the drawer closes first.
  useEscapeLayer(drawer, () => setDrawer(false));
  useEscapeLayer(termSheet, () => setTermSheet(false));

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1">
        {center ?? <ChatPanel key={chatProps.session?.id ?? 'none'} {...chatProps} onMenu={() => setDrawer(true)} onTerminal={() => setTermSheet(true)} terminalRunning={!!runningTerm} />}
      </div>

      {drawer && (
        <MobileDrawer onClose={() => setDrawer(false)}>
          {drawerNav}
        </MobileDrawer>
      )}

      {termSheet && <TerminalSheet termProps={termProps} onClose={() => setTermSheet(false)} />}
    </div>
  );
}
