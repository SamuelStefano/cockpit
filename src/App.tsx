import { useState, useEffect, useRef, useMemo } from 'react';
import { SessionsPanel } from './components/Sessions';
import { ChatPanel } from './components/Chat';
import { TerminalsPanel } from './components/Terminals';
import { MobileLayout } from './components/Mobile';
import { StatusBar } from './components/StatusBar';
import { Header, QuotaBanner, CollapsedRail, CollapseBtn, OfflineNotice } from './components/AppChrome';
import { Contextos } from './routes/Contextos';
import { Skills } from './routes/Skills';
import { Observatorio } from './routes/Observatorio';
import { Admin } from './routes/Admin';
import { CommandPalette } from './components/CommandPalette';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { useCockpit } from './useCockpit';
import { useRoute, type Route } from './useRoute';
import { usePersisted } from './lib/persist';
import { setTitleBase } from './lib/notify';
import { relReset } from './lib/time';
import { TERMINALS_SEED, type Terminal } from './data/mock';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

let _tid = 100;
const nextId = (p: string) => `${p}${++_tid}`;

// --- CockpitApp ------------------------------------------------------------

export function CockpitApp() {
  const cockpit = useCockpit();
  const {
    sessions, loading, activeId: activeSessionId, setActiveId: setActiveSessionId,
    messages, phase, running, stalled, updated, draft, setDraft, conn, rate, stats, mode, setMode, model, setModel, effort, setEffort, budget, setBudget, slashCommands, term,
    archived, onUnhide: handleUnhide, contextTokens, usage, lastTurn, lastEnd, searchResults, onSearch,
    contexts, openContext, onCtxList, onCtxOpen, onCtxClose,
    skills, openSkill, onSkillList, onSkillOpen, onSkillClose,
    usageStats, onUsageList, health, onHealthList,
    attachments, onUpload, onRemoveAttachment,
    onSend: handleSend, onStop: handleStop, onNew: cockpitNew, onRename: handleRename, onClose: handleCloseSession,
    onOpenFull,
  } = cockpit;

  const { route, nav } = useRoute();

  const [terminals, setTerminals] = usePersisted<Terminal[]>('terminals', TERMINALS_SEED);
  const [activeTermId, setActiveTermId] = usePersisted('term.active', 'main');

  const [quotaClosed, setQuotaClosed] = useState(false);
  const quota = !!rate && !quotaClosed;

  // Só alarma depois de ~6s offline (atravessa o flap reconnecting↔down sem piscar).
  const offlineSince = useRef<number | null>(null);
  const [showOffline, setShowOffline] = useState(false);
  useEffect(() => {
    if (conn.ws === 'connected') { offlineSince.current = null; setShowOffline(false); return; }
    if (offlineSince.current == null) offlineSince.current = Date.now();
    const id = setTimeout(() => setShowOffline(true), Math.max(0, 6000 - (Date.now() - offlineSince.current)));
    return () => clearTimeout(id);
  }, [conn.ws]);

  const [leftW, setLeftW] = usePersisted('panel.left', 17);
  const [rightW, setRightW] = usePersisted('panel.right', 37);
  const [leftCollapsed, setLeftCollapsed] = usePersisted('panel.leftCollapsed', false);
  const [rightCollapsed, setRightCollapsed] = usePersisted('panel.rightCollapsed', false);
  const [isMobile, setIsMobile] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [termSheet, setTermSheet] = useState(false);
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);
  const [navPins] = usePersisted<string[]>('pinned', []); // espelha a ordem do sidebar p/ Alt+↑/↓

  const editUser = (text: string) => { setDraft(text); setFocusSignal((n) => n + 1); };

  // Citar uma mensagem: vira blockquote no topo do rascunho atual (trunca longos).
  const quoteMsg = (text: string) => {
    const clipped = text.length > 280 ? text.slice(0, 280).trimEnd() + '…' : text;
    const quoted = clipped.split('\n').map((l) => '> ' + l).join('\n');
    setDraft((draft ? draft.trimEnd() + '\n\n' : '') + quoted + '\n\n');
    setFocusSignal((n) => n + 1);
  };

  // Custo estimado acumulado por sessão (do observatório) → chip no sidebar.
  const sessionCost = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of usageStats?.sessions ?? []) m[s.sessionId] = s.costUsd;
    return m;
  }, [usageStats]);

  const rowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ which: string; startX: number; startLeft: number; startRight: number; w: number } | null>(null);

  useEffect(() => {
    if (!activeSessionId && sessions.length) setActiveSessionId(sessions[0].id);
  }, [activeSessionId, sessions, setActiveSessionId]);

  // Reflete atividade no título da aba (visível com a aba em background no run
  // noturno): "▶N" rodando, "●N" com output novo não visto.
  useEffect(() => {
    const parts: string[] = [];
    if (running.size) parts.push(`▶${running.size}`);
    if (updated.size) parts.push(`●${updated.size}`);
    setTitleBase((parts.length ? parts.join(' ') + ' — ' : '') + 'cockpit');
  }, [running, updated]);

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

  // Alt+↑/↓ cicla entre sessões (ergonomia do run noturno multi-sessão). Usa a
  // mesma ordem do sidebar (fixadas no topo). Funciona mesmo com o input em foco
  // — Alt+seta não é combo de edição de texto comum.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const pinSet = new Set(navPins);
      const ordered = [...sessions.filter((s) => pinSet.has(s.id)), ...sessions.filter((s) => !pinSet.has(s.id))];
      if (ordered.length < 2) return;
      e.preventDefault();
      const i = ordered.findIndex((s) => s.id === activeSessionId);
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const next = ordered[(((i < 0 ? 0 : i) + delta) % ordered.length + ordered.length) % ordered.length];
      if (next) setActiveSessionId(next.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sessions, activeSessionId, navPins, setActiveSessionId]);

  // `n` salta pra próxima sessão com output novo não visto (ergonomia do run
  // noturno: vários turnos terminam em background; `n` cicla só pelas que
  // produziram algo). `n` é tecla de digitação — só age fora de input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (!updated.size) return;
      const pinSet = new Set(navPins);
      const ordered = [...sessions.filter((s) => pinSet.has(s.id)), ...sessions.filter((s) => !pinSet.has(s.id))];
      if (!ordered.length) return;
      e.preventDefault();
      const start = ordered.findIndex((s) => s.id === activeSessionId);
      for (let k = 1; k <= ordered.length; k++) {
        const cand = ordered[((start < 0 ? -1 : start) + k) % ordered.length];
        if (cand && updated.has(cand.id)) { setActiveSessionId(cand.id); nav('/'); break; }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sessions, activeSessionId, navPins, updated, setActiveSessionId, nav]);

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
    <div
      className="relative flex h-full flex-col bg-neutral-950"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <CommandPalette
        open={palette} onClose={() => setPalette(false)}
        route={route} nav={nav} onNew={handleNew}
        mode={mode} setMode={setMode}
        sessions={sessions} onSelectSession={setActiveSessionId}
        running={running} onStop={handleStop} onFocusComposer={() => setFocusSignal((n) => n + 1)}
        onShowHelp={() => setHelp(true)}
      />
      <ShortcutsHelp open={help} onClose={() => setHelp(false)} />
      <Header conn={conn} onNew={handleNew} isMobile={isMobile} onMenu={() => setDrawer(true)} route={route} nav={nav} onPalette={() => setPalette(true)} cost={usageStats?.totalCost ?? 0} rate={rate} ctxTokens={contextTokens} lastTurn={lastTurn} />

      {quota && rate && <QuotaBanner reset={relReset(rate.resetsAt)} onClose={() => setQuotaClosed(true)} />}
      <OfflineNotice show={showOffline} />

      {route === '/contextos' ? (
        <Contextos connected={conn.ws === 'connected'} contexts={contexts} openContext={openContext}
          onCtxList={onCtxList} onCtxOpen={onCtxOpen} onCtxClose={onCtxClose} />
      ) : route === '/skills' ? (
        <Skills connected={conn.ws === 'connected'} skills={skills} openSkill={openSkill}
          onSkillList={onSkillList} onSkillOpen={onSkillOpen} onSkillClose={onSkillClose} />
      ) : route === '/uso' ? (
        <Observatorio connected={conn.ws === 'connected'} usageStats={usageStats} onUsageList={onUsageList} sessions={sessions}
          onOpenSession={(id) => { setActiveSessionId(id); nav('/'); }} />
      ) : route === '/admin' ? (
        <Admin health={health} onHealthList={onHealthList} />
      ) : isMobile ? (
        <MobileLayout
          sessionsProps={{ sessions, loading, activeId: activeSessionId, onSelect: setActiveSessionId, onNew: handleNew, onRename: handleRename, onClose: handleCloseSession, onStop: handleStop, archived, onUnhide: handleUnhide, usage, cost: sessionCost, running, stalled, updated, searchResults, onSearch }}
          chatProps={{ session: activeSession, messages, phase: viewPhase, draft, setDraft, onSend: handleSend, onPrompt: handleSend, onStop: handleStop, mode, setMode, model, setModel, effort, setEffort, budget, setBudget, slashCommands, contextTokens, lastTurn, lastEnd, onNew: handleNew, attachments, onUpload, onRemoveAttachment, onEditUser: editUser, onQuote: quoteMsg, onOpenFull, onShowHelp: () => setHelp(true), focusSignal }}
          termProps={{ terminals, activeId: activeTermId, onSelect: setActiveTermId, onAdd: handleAddTerm, onClose: handleCloseTerm, term }}
          drawer={drawer} setDrawer={setDrawer}
          termSheet={termSheet} setTermSheet={setTermSheet}
          runningTerm={runningTerm}
        />
      ) : (
        <div ref={rowRef} className="flex min-h-0 flex-1">
          {leftCollapsed ? (
            <CollapsedRail side="left" label="Sessões" icon="message" onExpand={() => setLeftCollapsed(false)} />
          ) : (
            <>
              <div style={{ width: `${leftW}%` }} className="relative min-w-0 shrink-0 border-r border-neutral-800">
                <SessionsPanel sessions={sessions} loading={loading} activeId={activeSessionId}
                  onSelect={setActiveSessionId} onNew={handleNew} onRename={handleRename} onClose={handleCloseSession} onStop={handleStop}
                  archived={archived} onUnhide={handleUnhide} usage={usage} cost={sessionCost} running={running} stalled={stalled} updated={updated} searchResults={searchResults} onSearch={onSearch} />
                <CollapseBtn side="left" onClick={() => setLeftCollapsed(true)} />
              </div>
              <div className="resizer w-[3px] shrink-0 cursor-col-resize bg-neutral-800" onMouseDown={startDrag('left')} />
            </>
          )}

          <div className="min-w-0 flex-1">
            <ChatPanel key={activeSession?.id ?? 'none'} session={activeSession} messages={messages} phase={viewPhase}
              draft={draft} setDraft={setDraft} onSend={handleSend} onPrompt={handleSend} onStop={handleStop}
              mode={mode} setMode={setMode} model={model} setModel={setModel} effort={effort} setEffort={setEffort} budget={budget} setBudget={setBudget} slashCommands={slashCommands} contextTokens={contextTokens} lastTurn={lastTurn} lastEnd={lastEnd} onNew={handleNew}
              attachments={attachments} onUpload={onUpload} onRemoveAttachment={onRemoveAttachment}
              onEditUser={editUser} onQuote={quoteMsg} onOpenFull={onOpenFull} onShowHelp={() => setHelp(true)} focusSignal={focusSignal} />
          </div>

          {rightCollapsed ? (
            <CollapsedRail side="right" label="Terminais" icon="terminal" onExpand={() => setRightCollapsed(false)} />
          ) : (
            <>
              <div className="resizer w-[3px] shrink-0 cursor-col-resize bg-neutral-800" onMouseDown={startDrag('right')} />
              <div style={{ width: `${rightW}%` }} className="relative min-w-0 shrink-0 border-l border-neutral-800">
                <TerminalsPanel terminals={terminals} activeId={activeTermId} onSelect={setActiveTermId}
                  onAdd={handleAddTerm} onClose={handleCloseTerm} term={term} />
                <CollapseBtn side="right" onClick={() => setRightCollapsed(true)} />
              </div>
            </>
          )}
        </div>
      )}

      <StatusBar stats={stats} rate={rate} ctxTokens={contextTokens} lastTurn={lastTurn} />
    </div>
  );
}
