import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { EmptyState } from '../../components/primitives';
import { Hud } from './hud/Hud';
import { useBaseEngine } from './useBaseEngine';
import { useSessionLink } from './useSessionLink';
import { useLiveFeed, type LiveSource } from './useLiveFeed';
import { useMissions } from './useMissions';
import { MissionRoomPanel } from './hud/MissionRoomPanel';
import type { Mission } from './missions';
import './base.css';

// Methods the 3D wall adds to the engine; optional so this file compiles either way.
interface MissionEngine {
  setMissions?: (m: Mission[]) => void;
  setSelectedMission?: (id: string | null) => void;
  onMissionClick?: ((id: string) => void) | null;
}

const isTyping = (t: EventTarget | null): boolean => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

// Separate from Base so the engine, its polling and three.js never start below the desktop width.
export function BaseStage({ source }: { source: LiveSource }) {
  const worldRef = useRef<HTMLDivElement>(null), labelsRef = useRef<HTMLDivElement>(null);
  const { live, actions } = useLiveFeed(source);
  const { store, engine, failed } = useBaseEngine(worldRef, labelsRef, live, actions, 'live', true);
  const selected = useSyncExternalStore(store.subscribe, () => store.get().inspect?.sessionId);
  useSessionLink(engine, live, selected, source.connected && source.sessions.length > 0);
  const { missions, completeMission } = useMissions(source);
  const [roomOpen, setRoomOpen] = useState(false);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  useEffect(() => { (engine as MissionEngine | null)?.setMissions?.(missions); }, [engine, missions]);
  useEffect(() => { (engine as MissionEngine | null)?.setSelectedMission?.(selectedMissionId); }, [engine, selectedMissionId]);
  useEffect(() => {
    const e = engine as (MissionEngine & object) | null;
    if (!e) return;
    e.onMissionClick = (id) => { setSelectedMissionId(id); setRoomOpen(true); };
    return () => { e.onMissionClick = null; };
  }, [engine]);
  // M is already the sound toggle, so the Mission Room takes T.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key.toLowerCase() !== 't' || ev.ctrlKey || ev.metaKey || ev.altKey || isTyping(ev.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      setRoomOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (failed) return <EmptyState icon="monitor" title="WebGL unavailable" description="Agent Base needs WebGL to draw the floor." />;
  return (
    <div className="base-root">
      <div ref={worldRef} className="base-world" />
      <div ref={labelsRef} className="base-labels" />
      {engine && <Hud store={store} engine={engine} live={actions} source={source} />}
      {engine && (
        <>
          <button type="button" className={`base-missions-btn${roomOpen ? ' on' : ''}`} style={{ position: 'absolute', left: 10, bottom: 10, zIndex: 2 }} onClick={() => setRoomOpen((o) => !o)}>
            Missions{missions.length ? ` (${missions.length})` : ''} · T
          </button>
          <MissionRoomPanel
            missions={missions}
            open={roomOpen}
            onClose={() => { setRoomOpen(false); setSelectedMissionId(null); }}
            selectedId={selectedMissionId}
            onSelectMission={setSelectedMissionId}
            onComplete={completeMission}
          />
        </>
      )}
    </div>
  );
}
