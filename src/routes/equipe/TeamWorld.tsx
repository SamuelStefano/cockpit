import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { TeamBot } from '../../../shared/protocol';
import type { TeamState } from '../../../shared/team-state';
import { isRunning, MEETING_LIMITS, type MeetingInput, type TeamMeeting } from '../../../shared/team-meeting';
import { MeetingPanel } from './MeetingPanel';
import { navigateTo } from '../../lib/route-nav';
import { agentPath } from '../../useRoute';
import { demoMeeting, initialWorldUi, isDemo, parseInitialMode, worldUiReducer, type CameraMode } from './world/camera-mode';
import { DEMO_BOTS, DEMO_COUNTS, DEMO_MEETING, DEMO_PROJECTS, demoMergedCounts, demoTeamState } from './world/demo-data';
import { deriveWorld } from './world/world-state';
import { useCelebrate } from './world/useCelebrate';
import type { MergedCounts } from './world/world-celebrate';
import { WORLD_ERROR } from './world/world-map';
import type { WorldHandle } from './world/world-scene';
import { WORLD_V2_STORAGE_KEY, isWorldV2 } from './world/world-v2-layout';

interface TeamWorldProps {
  state: TeamState | null;
  connected: boolean;
  onRefresh: () => void;
  bots: TeamBot[];
  meetings: TeamMeeting[];
  onMeetingsGet: () => void;
  onMeetingStart: (input: MeetingInput) => void;
  // Merged PR count per bot id. Not wired to a real source yet; a rise triggers the celebration.
  mergedCounts?: MergedCounts;
  paused?: boolean;
  onPauseSet?: (paused: boolean) => void;
}

const DEMO_TEAM: TeamBot[] = DEMO_BOTS.map((b) => ({ id: b.id, name: b.name, label: '', instructions: '', mascot: { shape: 'blob', color: '#3fd17f' }, profile: 'full', createdAt: 0, updatedAt: 0 }));

const DEMO_TICK_MS = 7000;
const isCoarse = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const storedV2 = (): string | null => { try { return localStorage.getItem(WORLD_V2_STORAGE_KEY); } catch { return null; } };
const loadFactory = (v2: boolean) => (v2
  ? import('./world/world-scene-v2').then((m) => ({ create: m.createWorldV2, loadFont: m.loadWorldFont }))
  : import('./world/world-scene').then((m) => ({ create: m.createWorld, loadFont: m.loadWorldFont })));

const chip = 'inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium backdrop-blur pointer-coarse:min-h-11 pointer-coarse:px-4';
const chipOff = 'border-white/10 bg-neutral-950/75 text-neutral-200 hover:bg-neutral-900/90';
const chipOn = 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200';

// 2D team world: bots as NPCs on a plaza, projects as houses on a street. The
// canvas only ever receives names, states and counts (see world-state.ts).
export function TeamWorld({ state, connected, onRefresh, bots, meetings, onMeetingsGet, onMeetingStart, mergedCounts, paused = false, onPauseSet }: TeamWorldProps) {
  const demo = useMemo(() => isDemo(location.search), []);
  const v2 = useMemo(() => isWorldV2(location.search, storedV2()), []);
  const mapError = v2 ? null : WORLD_ERROR;
  const [ui, dispatch] = useReducer(worldUiReducer, location.search, (s) => initialWorldUi(parseInitialMode(s)));
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  // Re-derives the world so the plaza breaks of long-idle bots start and end on time.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);
  const [panel, setPanel] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [demoMeet, setDemoMeet] = useState(() => demoMeeting(location.search));
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<WorldHandle | null>(null);
  const modeRef = useRef<CameraMode>(ui.mode);
  modeRef.current = ui.mode;

  useEffect(() => { if (connected && !demo) { onRefresh(); onMeetingsGet(); } }, [connected, demo, onRefresh, onMeetingsGet]);
  // Only ids reach the world: never the question, answers or minutes.
  const live = useMemo(() => meetings.find(isRunning), [meetings]);
  const meeting = useMemo(
    () => (demo ? (demoMeet ? { participantIds: DEMO_MEETING, moderatorId: DEMO_MEETING[0] } : null) : live ? { participantIds: [...new Set([...live.participantIds, live.moderatorId])], moderatorId: live.moderatorId } : null),
    [demo, demoMeet, live],
  );
  useEffect(() => {
    if (!demo) return;
    const id = setInterval(() => setTick((t) => t + 1), DEMO_TICK_MS);
    return () => clearInterval(id);
  }, [demo]);

  const merged = useMemo(() => (demo ? demoMergedCounts(tick) : mergedCounts), [demo, tick, mergedCounts]);
  const celebrate = useCelebrate(merged);

  const view = useMemo(
    () => (demo ? deriveWorld(demoTeamState(Date.now(), tick), { counts: DEMO_COUNTS, projects: DEMO_PROJECTS, meeting, celebrate }) : deriveWorld(state, { meeting, celebrate, now: clock })),
    [demo, state, tick, meeting, celebrate, clock],
  );
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const el = host.current;
    if (!el || mapError) return;
    let dead = false;
    let ro: ResizeObserver | null = null;
    loadFactory(v2).then(async ({ create, loadFont }) => {
      await loadFont().catch(() => {});
      if (dead) return;
      const h = create({
        parent: el,
        mode: modeRef.current,
        coarse: isCoarse(),
        onOpenBot: (id) => { if (!demo) navigateTo(agentPath(id, 'computador')); },
        onToggleBot: (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MEETING_LIMITS.maxParticipants ? p : [...p, id])),
        onReady: () => { setReady(true); h.update(viewRef.current); },
        onError: () => { if (!dead) setFailed(true); },
      } as Parameters<typeof create>[0]);
      world.current = h;
      ro = new ResizeObserver(() => h.refresh());
      ro.observe(el);
    }).catch(() => { if (!dead) setFailed(true); });
    return () => { dead = true; ro?.disconnect(); world.current?.destroy(); world.current = null; };
  }, [demo, v2, mapError]);

  useEffect(() => { world.current?.update(view); }, [view]);
  useEffect(() => { world.current?.setMode(ui.mode); }, [ui.mode]);
  useEffect(() => { world.current?.setSelection(panel, picked); }, [panel, picked, ready]);
  useEffect(() => {
    world.current?.setRecording(ui.recording);
    window.dispatchEvent(new Event('resize'));
  }, [ui.recording]);
  useEffect(() => {
    if (!ui.recording) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dispatch({ t: 'exit-recording' }); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui.recording]);

  const wrap = ui.recording ? 'fixed inset-0 z-[70] bg-[#0a0908]' : 'relative min-h-[420px] flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#0a0908]';
  return (
    <div className={wrap} data-world-ready={ready ? '1' : '0'} data-world-mode={ui.mode} data-world-version={v2 ? '2' : '1'}>
      <div ref={host} className="absolute inset-0 touch-none" />
      {!ready && !failed && <div className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-neutral-400">Carregando o mundo...</div>}
      {mapError && <div role="alert" className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-red-300">Mapa do mundo inválido: {mapError}</div>}
      {failed && <div className="absolute inset-0 grid place-items-center text-xs text-red-300">Não foi possível carregar o mundo.</div>}
      {!ui.recording && (
        <>
          <div className="absolute left-2 top-2 flex gap-1.5">
            <button type="button" className={`${chip} ${ui.mode === 'avatar' ? chipOn : chipOff}`} aria-pressed={ui.mode === 'avatar'} onClick={() => dispatch({ t: 'set-mode', mode: 'avatar' })}>Deck</button>
            <button type="button" className={`${chip} ${ui.mode === 'god' ? chipOn : chipOff}`} aria-pressed={ui.mode === 'god'} onClick={() => dispatch({ t: 'set-mode', mode: 'god' })}>Modo Deus</button>
          </div>
          <div className="absolute right-2 top-2 flex items-center gap-1.5 max-sm:left-2 max-sm:right-auto max-sm:top-12">
            {demo && <span className="rounded-md border border-amber-400/30 bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200">demo</span>}
            {onPauseSet && !demo && (
              <button type="button" className={`${chip} ${paused ? chipOn : chipOff}`} aria-pressed={paused} onClick={() => onPauseSet(!paused)}>{paused ? 'Retomar vila' : 'Pausar vila'}</button>
            )}
            <button type="button" className={`${chip} ${panel ? chipOn : chipOff}`} aria-pressed={panel} onClick={() => setPanel((v) => !v)}>Reunião</button>
            <button type="button" className={`${chip} ${chipOff}`} aria-pressed={false} onClick={() => dispatch({ t: 'toggle-recording' })}>Gravação</button>
          </div>
          {panel && (
            <MeetingPanel
              bots={demo ? DEMO_TEAM : bots} running={!!meeting} picked={picked} onPick={setPicked} onClose={() => setPanel(false)}
              onStart={(i) => { if (demo) setDemoMeet(true); else onMeetingStart(i); }}
            />
          )}
          <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-neutral-950/70 px-2 py-1 text-[11px] text-neutral-400 max-sm:hidden">
            {ui.mode === 'avatar' ? 'WASD ou setas · botão direito para andar · clique num bot para abrir o computador dele' : 'arraste para mover · roda ou pinça para o zoom · clique num bot'}
          </p>
        </>
      )}
      {ui.recording && (
        <button type="button" aria-label="Sair da gravação" className="absolute right-2 top-2 h-7 w-7 rounded-full border border-white/10 bg-white/5 text-[11px] text-white/40 opacity-30 hover:opacity-100" onClick={() => dispatch({ t: 'exit-recording' })}>×</button>
      )}
    </div>
  );
}
