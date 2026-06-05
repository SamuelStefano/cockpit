import { useState, useEffect, useRef } from 'react';
import { Icon, ConnDot, type ConnState } from './components/primitives';
import { SessionsPanel } from './components/Sessions';
import { ChatPanel } from './components/Chat';
import { TerminalsPanel } from './components/Terminals';
import { MobileLayout } from './components/Mobile';
import { StatusBar } from './components/StatusBar';
import { Contextos } from './routes/Contextos';
import { Skills } from './routes/Skills';
import { useCockpit } from './useCockpit';
import { useRoute, type Route } from './useRoute';
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
  onNew: () => void;
  isMobile: boolean;
  onMenu: () => void;
  route: Route;
  nav: (to: Route) => void;
}

const NAV: { to: Route; label: string }[] = [
  { to: '/', label: 'chat' },
  { to: '/contextos', label: 'contextos' },
  { to: '/skills', label: 'skills' },
];

function Header({ conn, onNew, isMobile, onMenu, route, nav }: HeaderProps) {
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
        <nav className="ml-1 flex items-center gap-0.5 rounded-lg border border-neutral-800 bg-neutral-900/60 p-0.5">
          {NAV.map((n) => (
            <button
              key={n.to}
              onClick={() => nav(n.to)}
              className={`rounded-md px-2.5 py-1 font-mono text-[11.5px] lowercase tracking-tight transition
                ${route === n.to ? 'bg-orange-500/15 text-orange-300' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-1">
          <ConnDot label="ws" state={conn.ws} compact={isMobile} />
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
    messages, phase, draft, setDraft, conn, rate, stats, mode, setMode, term,
    archived, onUnhide: handleUnhide, contextTokens, searchResults, onSearch,
    contexts, openContext, onCtxList, onCtxOpen, onCtxClose,
    skills, openSkill, onSkillList, onSkillOpen, onSkillClose,
    attachments, onUpload, onRemoveAttachment,
    onSend: handleSend, onStop: handleStop, onNew: cockpitNew, onRename: handleRename, onClose: handleCloseSession,
  } = cockpit;

  const { route, nav } = useRoute();

  const [terminals, setTerminals] = useState<Terminal[]>(TERMINALS_SEED);
  const [activeTermId, setActiveTermId] = useState('main');

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
    nav('/');
  };

  const handleAddTerm = () => {
    const id = nextId('term-');
    const n = terminals.length + 1;
    setTerminals((prev) => [...prev, { id, name: `shell ${n}` }]);
    setActiveTermId(id);
  };

  const handleCloseTerm = (id: string) => {
    term.kill(id);
    setTerminals((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (id === activeTermId && next.length) setActiveTermId(next[0].id);
      return next;
    });
  };

  const runningTerm = terminals[0];

  return (
    <div className="relative flex h-full flex-col bg-neutral-950">
      <Header conn={conn} onNew={handleNew} isMobile={isMobile} onMenu={() => setDrawer(true)} route={route} nav={nav} />

      {quota && rate && <QuotaBanner reset={relReset(rate.resetsAt)} onClose={() => setQuotaClosed(true)} />}

      {route === '/contextos' ? (
        <Contextos connected={conn.ws === 'connected'} contexts={contexts} openContext={openContext}
          onCtxList={onCtxList} onCtxOpen={onCtxOpen} onCtxClose={onCtxClose} />
      ) : route === '/skills' ? (
        <Skills connected={conn.ws === 'connected'} skills={skills} openSkill={openSkill}
          onSkillList={onSkillList} onSkillOpen={onSkillOpen} onSkillClose={onSkillClose} />
      ) : isMobile ? (
        <MobileLayout
          sessionsProps={{ sessions, loading, activeId: activeSessionId, onSelect: setActiveSessionId, onNew: handleNew, onRename: handleRename, onClose: handleCloseSession, archived, onUnhide: handleUnhide, searchResults, onSearch }}
          chatProps={{ session: activeSession, messages, phase: viewPhase, draft, setDraft, onSend: handleSend, onPrompt: handleSend, onStop: handleStop, mode, setMode, contextTokens, onNew: handleNew, attachments, onUpload, onRemoveAttachment }}
          termProps={{ terminals, activeId: activeTermId, onSelect: setActiveTermId, onAdd: handleAddTerm, onClose: handleCloseTerm, term }}
          drawer={drawer} setDrawer={setDrawer}
          termSheet={termSheet} setTermSheet={setTermSheet}
          runningTerm={runningTerm}
        />
      ) : (
        <div ref={rowRef} className="flex min-h-0 flex-1">
          <div style={{ width: `${leftW}%` }} className="min-w-0 shrink-0 border-r border-neutral-800">
            <SessionsPanel sessions={sessions} loading={loading} activeId={activeSessionId}
              onSelect={setActiveSessionId} onNew={handleNew} onRename={handleRename} onClose={handleCloseSession}
              archived={archived} onUnhide={handleUnhide} searchResults={searchResults} onSearch={onSearch} />
          </div>
          <div className="resizer w-[3px] shrink-0 cursor-col-resize bg-neutral-800" onMouseDown={startDrag('left')} />

          <div style={{ width: `${100 - leftW - rightW}%` }} className="min-w-0 flex-1">
            <ChatPanel session={activeSession} messages={messages} phase={viewPhase}
              draft={draft} setDraft={setDraft} onSend={handleSend} onPrompt={handleSend} onStop={handleStop}
              mode={mode} setMode={setMode} contextTokens={contextTokens} onNew={handleNew}
              attachments={attachments} onUpload={onUpload} onRemoveAttachment={onRemoveAttachment} />
          </div>

          <div className="resizer w-[3px] shrink-0 cursor-col-resize bg-neutral-800" onMouseDown={startDrag('right')} />
          <div style={{ width: `${rightW}%` }} className="min-w-0 shrink-0 border-l border-neutral-800">
            <TerminalsPanel terminals={terminals} activeId={activeTermId} onSelect={setActiveTermId}
              onAdd={handleAddTerm} onClose={handleCloseTerm} term={term} />
          </div>
        </div>
      )}

      <StatusBar stats={stats} />
    </div>
  );
}
