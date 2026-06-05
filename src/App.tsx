import { useState, useEffect, useRef } from 'react';
import { Icon, ConnDot, type ConnState } from './components/primitives';
import { SessionsPanel } from './components/Sessions';
import { ChatPanel } from './components/Chat';
import { TerminalsPanel } from './components/Terminals';
import { MobileLayout } from './components/Mobile';
import { useCockpit } from './useCockpit';
import { TERMINALS_SEED, type Terminal } from './data/mock';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

let _tid = 100;
const nextId = (p: string) => `${p}${++_tid}`;

function relReset(resetsAt: number): string {
  const diff = resetsAt - Date.now();
  if (diff <= 0) return 'agora';
  const min = Math.round(diff / 60000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  return `${h}h${String(min % 60).padStart(2, '0')}`;
}

// --- Header ----------------------------------------------------------------

interface HeaderProps {
  conn: { ws: ConnState; sse: ConnState };
  cycleConn: (key: 'ws' | 'sse') => void;
  onNew: () => void;
  isMobile: boolean;
  onMenu: () => void;
}

function Header({ conn, cycleConn, onNew, isMobile, onMenu }: HeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-3">
      <div className="flex items-center gap-2.5">
        {isMobile && (
          <button onClick={onMenu} className="-ml-1 rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100">
            <Icon name="menu" size={18} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-500 text-neutral-950 shadow-[0_0_12px_-1px_rgba(249,115,22,0.55)]">
            <Icon name="terminal" size={14} stroke={2.4} />
          </span>
          <span className="font-mono text-[14px] font-semibold lowercase tracking-tight text-neutral-100">cockpit</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-1">
          <button onClick={() => cycleConn('ws')} title="Conexão WebSocket (terminal) — clique para alternar">
            <ConnDot label="ws" state={conn.ws} compact={isMobile} />
          </button>
          <span className="h-3 w-px bg-neutral-800" />
          <button onClick={() => cycleConn('sse')} title="Conexão SSE (chat) — clique para alternar">
            <ConnDot label="sse" state={conn.sse} compact={isMobile} />
          </button>
        </div>
        {!isMobile && (
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-2.5 py-1.5 text-[12.5px] font-semibold text-neutral-950 transition hover:bg-orange-400"
          >
            <Icon name="plus" size={15} stroke={2.4} /> Nova sessão
          </button>
        )}
      </div>
    </header>
  );
}

// --- QuotaBanner -----------------------------------------------------------

interface QuotaBannerProps {
  onClose: () => void;
  reset: string;
}

function QuotaBanner({ onClose, reset }: QuotaBannerProps) {
  return (
    <div className="fade-up pointer-events-none absolute left-1/2 top-[58px] z-40 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-yellow-500/30 bg-yellow-500/[0.12] px-3 py-2 shadow-2xl shadow-black/40 backdrop-blur-md">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-yellow-500/15 text-yellow-400">
          <Icon name="zap" size={13} />
        </span>
        <div className="leading-tight">
          <p className="text-[12px] font-medium text-yellow-200">Uso próximo do limite</p>
          <p className="text-[11px] text-yellow-200/60">o limite de uso reseta em {reset}</p>
        </div>
        <button onClick={onClose} className="ml-1 rounded p-1 text-yellow-200/50 transition hover:bg-yellow-500/10 hover:text-yellow-200">
          <Icon name="x" size={14} />
        </button>
      </div>
    </div>
  );
}

// --- CockpitApp ------------------------------------------------------------

export function CockpitApp() {
  const cockpit = useCockpit();
  const {
    sessions, loading, activeId: activeSessionId, setActiveId: setActiveSessionId,
    messages, phase, draft, setDraft, conn, rate,
    onSend: handleSend, onStop: handleStop, onNew: cockpitNew, onRename: handleRename,
  } = cockpit;

  const [terminals, setTerminals] = useState<Terminal[]>(TERMINALS_SEED);
  const [activeTermId, setActiveTermId] = useState('t1');

  const [quotaClosed, setQuotaClosed] = useState(false);
  const quota = !!rate && !quotaClosed;

  const [leftW, setLeftW] = useState(17);
  const [rightW, setRightW] = useState(37);
  const [isMobile, setIsMobile] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [termSheet, setTermSheet] = useState(false);

  const rowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ which: string; startX: number; startLeft: number; startRight: number; w: number } | null>(null);

  useEffect(() => {
    if (!activeSessionId && sessions.length) setActiveSessionId(sessions[0].id);
  }, [activeSessionId, sessions, setActiveSessionId]);

  useEffect(() => {
    const samples = [
      { t: 'out' as const, s: 'GET  /v1/sessions 200 5ms' },
      { t: 'out' as const, s: 'POST /auth/refresh 200 23ms' },
      { t: 'out' as const, s: 'GET  /health 200 0.9ms' },
      { t: 'warn' as const, s: 'WARN slow query 412ms — /v1/messages' },
      { t: 'out' as const, s: 'POST /webhook/github 200 16ms' },
      { t: 'ok' as const, s: '✓ cache hit ratio 0.94' },
    ];
    let k = 0;
    const id = setInterval(() => {
      setTerminals((prev) => prev.map((t) => {
        if (!t.running) return t;
        const stamp = new Date().toLocaleTimeString('pt-BR', { hour12: false });
        const ln = samples[k % samples.length];
        k++;
        const lines = [...t.lines, { t: ln.t, s: `${stamp} ${ln.s}` }];
        return { ...t, lines: lines.slice(-120) };
      }));
    }, 2600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const d = dragRef.current; if (!d) return;
      const dx = ((e.clientX - d.startX) / d.w) * 100;
      if (d.which === 'left') setLeftW(clamp(d.startLeft + dx, 13, 28));
      else setRightW(clamp(d.startRight - dx, 24, 48));
    };
    const up = () => {
      if (dragRef.current) {
        dragRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      document.querySelectorAll('.resizer.active').forEach((el) => el.classList.remove('active'));
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  const startDrag = (which: string) => (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rowRef.current) return;
    dragRef.current = { which, startX: e.clientX, startLeft: leftW, startRight: rightW, w: rowRef.current.offsetWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    (e.currentTarget as HTMLDivElement).classList.add('active');
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;
  const viewPhase = phase;

  const handleNew = () => {
    cockpitNew();
    setDrawer(false);
  };

  const handleAddTerm = () => {
    const id = nextId('t');
    const n = terminals.length + 1;
    const term: Terminal = {
      id, name: `shell ${n}`, running: true,
      pid: 3000 + Math.floor(Math.random() * 900),
      cwd: '~',
      lines: [
        { t: 'sys', s: 'novo pty anexado · vps-fra-01' },
        { t: 'cmd', s: 'bash -l' },
      ],
    };
    setTerminals((prev) => [...prev, term]);
    setActiveTermId(id);
  };

  const handleCloseTerm = (id: string) => {
    setTerminals((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (id === activeTermId && next.length) setActiveTermId(next[0].id);
      return next;
    });
  };

  const handleToggleRun = (id: string) => setTerminals((prev) => prev.map((t) => {
    if (t.id !== id) return t;
    if (t.running) return { ...t, running: false, pid: null, lines: [...t.lines, { t: 'sys' as const, s: 'processo interrompido · exit 130' }] };
    return { ...t, running: true, pid: 3000 + Math.floor(Math.random() * 900), lines: [...t.lines, { t: 'cmd' as const, s: 'pnpm dev --filter api' }, { t: 'ok' as const, s: '✓ reiniciado' }] };
  }));

  const cycleConn = (_key: 'ws' | 'sse') => {};

  const runningTerm = terminals.find((t) => t.running);

  return (
    <div className="relative flex h-full flex-col bg-neutral-950">
      <Header conn={conn} cycleConn={cycleConn} onNew={handleNew} isMobile={isMobile} onMenu={() => setDrawer(true)} />

      {quota && rate && <QuotaBanner reset={relReset(rate.resetsAt)} onClose={() => setQuotaClosed(true)} />}

      {isMobile ? (
        <MobileLayout
          sessionsProps={{ sessions, loading, activeId: activeSessionId, onSelect: setActiveSessionId, onNew: handleNew, onRename: handleRename }}
          chatProps={{ session: activeSession, messages, phase: viewPhase, draft, setDraft, onSend: handleSend, onPrompt: handleSend, onStop: handleStop }}
          termProps={{ terminals, activeId: activeTermId, onSelect: setActiveTermId, onAdd: handleAddTerm, onClose: handleCloseTerm, onToggleRun: handleToggleRun }}
          drawer={drawer} setDrawer={setDrawer}
          termSheet={termSheet} setTermSheet={setTermSheet}
          runningTerm={runningTerm}
        />
      ) : (
        <div ref={rowRef} className="flex min-h-0 flex-1">
          <div style={{ width: `${leftW}%` }} className="min-w-0 shrink-0 border-r border-neutral-800">
            <SessionsPanel sessions={sessions} loading={loading} activeId={activeSessionId}
              onSelect={setActiveSessionId} onNew={handleNew} onRename={handleRename} />
          </div>
          <div className="resizer w-[3px] shrink-0 cursor-col-resize bg-neutral-800" onMouseDown={startDrag('left')} />

          <div style={{ width: `${100 - leftW - rightW}%` }} className="min-w-0 flex-1">
            <ChatPanel session={activeSession} messages={messages} phase={viewPhase}
              draft={draft} setDraft={setDraft} onSend={handleSend} onPrompt={handleSend} onStop={handleStop} />
          </div>

          <div className="resizer w-[3px] shrink-0 cursor-col-resize bg-neutral-800" onMouseDown={startDrag('right')} />
          <div style={{ width: `${rightW}%` }} className="min-w-0 shrink-0 border-l border-neutral-800">
            <TerminalsPanel terminals={terminals} activeId={activeTermId} onSelect={setActiveTermId}
              onAdd={handleAddTerm} onClose={handleCloseTerm} onToggleRun={handleToggleRun} />
          </div>
        </div>
      )}
    </div>
  );
}
