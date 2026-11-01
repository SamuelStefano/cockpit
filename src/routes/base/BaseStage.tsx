import { useRef, useSyncExternalStore } from 'react';
import { EmptyState } from '../../components/primitives';
import { Hud } from './hud/Hud';
import { useBaseEngine } from './useBaseEngine';
import { useSessionLink } from './useSessionLink';
import { useLiveFeed, type LiveSource } from './useLiveFeed';
import './base.css';

// Separate from Base so the engine, its polling and three.js never start below the desktop width.
export function BaseStage({ source }: { source: LiveSource }) {
  const worldRef = useRef<HTMLDivElement>(null), labelsRef = useRef<HTMLDivElement>(null);
  const { live, actions } = useLiveFeed(source);
  const { store, engine, failed } = useBaseEngine(worldRef, labelsRef, live, actions, 'live', true);
  const selected = useSyncExternalStore(store.subscribe, () => store.get().inspect?.sessionId);
  useSessionLink(engine, live, selected, source.connected && source.sessions.length > 0);
  if (failed) return <EmptyState icon="monitor" title="WebGL unavailable" description="Agent Base needs WebGL to draw the floor." />;
  return (
    <div className="base-root">
      <div ref={worldRef} className="base-world" />
      <div ref={labelsRef} className="base-labels" />
      {engine && <Hud store={store} engine={engine} live={actions} source={source} />}
    </div>
  );
}
