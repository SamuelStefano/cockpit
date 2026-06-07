import { useState, useRef } from 'react';
import { SessionsPanel, type SessionsPanelProps } from './Sessions';
import { ChatPanel, type ChatPanelProps } from './Chat';
import { TerminalsPanel, type TerminalsPanelProps } from './Terminals';
import type { Terminal } from '../data/mock';

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
  sessionsProps: SessionsPanelProps;
  chatProps: ChatPanelProps;
  termProps: TerminalsPanelProps;
  drawer: boolean;
  setDrawer: (v: boolean) => void;
  termSheet: boolean;
  setTermSheet: (v: boolean) => void;
  runningTerm: Terminal | undefined;
}

export function MobileLayout({ sessionsProps, chatProps, termProps, drawer, setDrawer, termSheet, setTermSheet, runningTerm }: MobileLayoutProps) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1">
        <ChatPanel key={chatProps.session?.id ?? 'none'} {...chatProps} onTerminal={() => setTermSheet(true)} terminalRunning={!!runningTerm} />
      </div>

      {drawer && (
        <>
          <div className="absolute inset-0 z-40 bg-black/60" style={{ animation: 'overlayIn 0.2s ease' }} onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 z-50 w-[82%] max-w-[330px] border-r border-neutral-800 shadow-2xl" style={{ animation: 'drawerIn 0.26s cubic-bezier(0.22,1,0.36,1)' }}>
            <SessionsPanel {...sessionsProps} onCloseMobile={() => setDrawer(false)} />
          </div>
        </>
      )}

      {termSheet && <TerminalSheet termProps={termProps} onClose={() => setTermSheet(false)} />}
    </div>
  );
}
