import { useSyncExternalStore } from 'react';
import type { BaseEngine } from '../engine/engine';
import type { HudState } from '../hudState';
import type { Store } from '../store';
import type { LiveActions } from '../useLiveFeed';
import { AlertStack } from './AlertStack';
import { BottomBar } from './BottomBar';
import { ComposerPanel } from './ComposerPanel';
import { EndScreen } from './EndScreen';
import { FunnelPanel } from './FunnelPanel';
import { HistoryPanel } from './HistoryPanel';
import { Inspector } from './Inspector';
import { JourneyPanel } from './JourneyPanel';
import { Minimap } from './Minimap';
import { Pins } from './Pins';
import { ReplayBar } from './ReplayBar';
import { RuleOffer } from './RuleOffer';
import { SectorStrip } from './SectorStrip';
import { SideButtons } from './SideButtons';
import { SinceYouLeft } from './SinceYouLeft';
import { TopBar } from './TopBar';

export function Hud({ store, engine, live }: { store: Store<HudState>; engine: BaseEngine; live: LiveActions }) {
  const hud = useSyncExternalStore(store.subscribe, store.get);
  const practice = hud.mode === 'practice';
  return (
    <div className={`base-hud${hud.focused ? ' focus' : ''}`}>
      <TopBar hud={hud} engine={engine} />
      <SectorStrip hud={hud} engine={engine} />
      <AlertStack hud={hud} engine={engine} />
      <div className="base-keys">{practice ? 'I B S O R sectors · Z X C wings · 1–6 agents · Tab next · Q W E decide · Space pause · Wheel zoom · Drag pan · Esc back' : 'I B S O R sectors · Z X C V wings · 1–6 agents · Tab next · Wheel zoom · Drag pan · Esc back'}</div>
      <Minimap engine={engine} />
      <SideButtons hud={hud} engine={engine} />
      <Pins hud={hud} engine={engine} />
      {practice && <ReplayBar hud={hud} engine={engine} />}
      {practice && <BottomBar hud={hud} engine={engine} />}
      {hud.inspect && <Inspector key={hud.inspect.id} view={hud.inspect} engine={engine} live={live} />}
      {hud.journey && <JourneyPanel view={hud.journey} engine={engine} />}
      {hud.funnel && <FunnelPanel view={hud.funnel} engine={engine} />}
      {hud.history && <HistoryPanel hud={hud} engine={engine} />}
      {hud.composer && <ComposerPanel hud={hud} engine={engine} />}
      {hud.ruleOffer && <RuleOffer offer={hud.ruleOffer} engine={engine} />}
      {hud.toast && <div className="base-toast">{hud.toast}</div>}
      {hud.since && <SinceYouLeft since={hud.since} engine={engine} />}
      {hud.end && <EndScreen end={hud.end} engine={engine} />}
    </div>
  );
}
