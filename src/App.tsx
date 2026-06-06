import { useState, useEffect, useRef } from 'react';
import { Icon, ConnDot, type ConnState } from './components/primitives';
import { SessionsPanel } from './components/Sessions';
import { ChatPanel } from './components/Chat';
import { TerminalsPanel } from './components/Terminals';
import { MobileLayout } from './components/Mobile';
import { StatusBar } from './components/StatusBar';
import { Contextos } from './routes/Contextos';
import { Skills } from './routes/Skills';
import { Observatorio } from './routes/Observatorio';
import { CommandPalette } from './components/CommandPalette';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { useCockpit } from './useCockpit';
import { useRoute, type Route } from './useRoute';
import { usePersisted } from './lib/persist';
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
  onPalette: () => void;
  cost: number;
}

function fmtCost(n: number): string {
  if (n >= 100) return '$' + n.toFixed(0);
  if (n >= 1) return '$' + n.toFixed(2);
  if (n > 0) return '$' + n.toFixed(3);
  return '$0';
}

const NAV: { to: Route; label: string }[] = [
  { to: '/', label: 'chat' },
  { to: '/contextos', label: 'contextos' },
  { to: '/skills', label: 'skills' },
  { to: '/uso', label: 'uso' },
];

function Header({ conn, onNew, isMobile, onMenu, route, nav, onPalette, cost }: HeaderProps) {
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
        {cost > 0 && (
          <button
            onClick={() => nav('/uso')}
            title="Custo estimado acumulado — abrir Uso"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5 text-emerald-400/90 transition hover:border-emerald-500/30 hover:text-emerald-300"
          >
            <Icon name="zap" size={13} />
            <span className="font-mono text-[11.5px] tabular-nums">{fmtCost(cost)}</span>
          </button>
        )}
        <button
          onClick={onPalette}
          title="Comandos (⌘K)"
          className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5 text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-300"
        >
          <Icon name="search" size={14} />
          {!isMobile && <kbd className="font-mono text-[10px] text-neutral-600">⌘K</kbd>}
        </button>
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
    messages, phase, draft, setDraft, conn, rate, stats, mode, setMode, model, setModel, effort, setEffort, term,
    archived, onUnhide: handleUnhide, contextTokens, usage, lastTurn, searchResults, onSearch,
    contexts, openContext, onCtxList, onCtxOpen, onCtxClose,
    skills, openSkill, onSkillList, onSkillOpen, onSkillClose,
    usageStats, onUsageList,
    attachments, onUpload, onRemoveAttachment,
    onSend: handleSend, onStop: handleStop, onNew: cockpitNew, onRename: handleRename, onClose: handleCloseSession,
  } = cockpit;

  const { route, nav } = useRoute();

  const [terminals, setTerminals] = usePersisted<Terminal[]>('terminals', TERMINALS_SEED);
  const [activeTermId, setActiveTermId] = usePersisted('term.active', 'main');

  const [quotaClosed, setQuotaClosed] = useState(false);
  const quota = !!rate && !quotaClosed;

  const [leftW, setLeftW] = usePersisted('panel.left', 17);
  const [rightW, setRightW] = usePersisted('panel.right', 37);
  const [isMobile, setIsMobile] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [termSheet, setTermSheet] = useState(false);
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);

  const editUser = (text: string) => { setDraft(text); setFocusSignal((n) => n + 1); };

  const rowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ which: string; startX: number; startLeft: number; startRight: number; w: number } | null>(null);

  useEffect(() => {
    if (!activeSessionId && sessions.length) setActiveSessionId(sessions[0].id);
  }, [activeSessionId, sessions, setActiveSessionId]);

  // Evita colisão de id ao criar abas após restaurar do localStorage.
  useEffect(() => {
    for (const t of terminals) {
      const n = Number(t.id.replace(/^term-/, ''));
      if (Number.isFinite(n) && n > _tid) _tid = n;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        const el = document.activeElement as HTMLElement | null;
        const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
        if (!typing) { e.preventDefault(); setHelp((h) => !h); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
      <CommandPalette
        open={palette} onClose={() => setPalette(false)}
        route={route} nav={nav} onNew={handleNew}
        mode={mode} setMode={setMode}
        sessions={sessions} onSelectSession={setActiveSessionId}
      />
      <ShortcutsHelp open={help} onClose={() => setHelp(false)} />
      <Header conn={conn} onNew={handleNew} isMobile={isMobile} onMenu={() => setDrawer(true)} route={route} nav={nav} onPalette={() => setPalette(true)} cost={usageStats?.totalCost ?? 0} />

      {quota && rate && <QuotaBanner reset={relReset(rate.resetsAt)} onClose={() => setQuotaClosed(true)} />}

      {route === '/contextos' ? (
        <Contextos connected={conn.ws === 'connected'} contexts={contexts} openContext={openContext}
          onCtxList={onCtxList} onCtxOpen={onCtxOpen} onCtxClose={onCtxClose} />
      ) : route === '/skills' ? (
        <Skills connected={conn.ws === 'connected'} skills={skills} openSkill={openSkill}
          onSkillList={onSkillList} onSkillOpen={onSkillOpen} onSkillClose={onSkillClose} />
      ) : route === '/uso' ? (
        <Observatorio connected={conn.ws === 'connected'} usageStats={usageStats} onUsageList={onUsageList} sessions={sessions}
          onOpenSession={(id) => { setActiveSessionId(id); nav('/'); }} />
      ) : isMobile ? (
        <MobileLayout
          sessionsProps={{ sessions, loading, activeId: activeSessionId, onSelect: setActiveSessionId, onNew: handleNew, onRename: handleRename, onClose: handleCloseSession, archived, onUnhide: handleUnhide, usage, searchResults, onSearch }}
          chatProps={{ session: activeSession, messages, phase: viewPhase, draft, setDraft, onSend: handleSend, onPrompt: handleSend, onStop: handleStop, mode, setMode, model, setModel, effort, setEffort, contextTokens, lastTurn, onNew: handleNew, attachments, onUpload, onRemoveAttachment, onEditUser: editUser, focusSignal }}
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
              archived={archived} onUnhide={handleUnhide} usage={usage} searchResults={searchResults} onSearch={onSearch} />
          </div>
          <div className="resizer w-[3px] shrink-0 cursor-col-resize bg-neutral-800" onMouseDown={startDrag('left')} />

          <div style={{ width: `${100 - leftW - rightW}%` }} className="min-w-0 flex-1">
            <ChatPanel session={activeSession} messages={messages} phase={viewPhase}
              draft={draft} setDraft={setDraft} onSend={handleSend} onPrompt={handleSend} onStop={handleStop}
              mode={mode} setMode={setMode} model={model} setModel={setModel} effort={effort} setEffort={setEffort} contextTokens={contextTokens} lastTurn={lastTurn} onNew={handleNew}
              attachments={attachments} onUpload={onUpload} onRemoveAttachment={onRemoveAttachment}
              onEditUser={editUser} focusSignal={focusSignal} />
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
