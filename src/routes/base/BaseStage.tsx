import { useRef } from 'react';
import { EmptyState } from '../../components/primitives';
import { Hud } from './hud/Hud';
import { useBaseEngine } from './useBaseEngine';
import { useLiveFeed, type LiveSource } from './useLiveFeed';
import './base.css';

// Separate from Base so the engine, its polling and three.js never start below the desktop width.
export function BaseStage({ source }: { source: LiveSource }) {
  const worldRef = useRef<HTMLDivElement>(null), labelsRef = useRef<HTMLDivElement>(null);
  const { live, actions } = useLiveFeed(source);
  const { store, engine, failed } = useBaseEngine(worldRef, labelsRef, live, actions, 'live', true);
  if (failed) return <EmptyState icon="monitor" title="WebGL unavailable" description="Agent Base needs WebGL to draw the floor." />;
  return (
    <div className="base-root">
      <div ref={worldRef} className="base-world" />
      <div ref={labelsRef} className="base-labels" />
      {engine && <Hud store={store} engine={engine} live={actions} />}
    </div>
  );
}
