import type { LogLine, MonitorTab, Decision, SectorId, SectorRow, BaseMode, ModelFamily } from './types';
import type { EndSummary, FeedItem, RuleOffer, SinceSummary } from './sim-types';
import type { SoundPack } from './engine/audio';

export interface Ticket { id: number; title: string; pips: { value: number; bad: boolean; ok: boolean }[]; done: number; total: number }

export interface InspectView {
  id: string;
  name: string;
  modelLabel: string;
  family: ModelFamily;
  state: string;
  ctx: number | null;
  sessionId?: string;
  running?: boolean;
  tail?: string | null;
  tab?: MonitorTab;
  paused?: boolean;
  supervised?: boolean;
}
export interface JourneyView { title: string; status: string; rows: { t: number; what: string }[] }
export interface FunnelBranch { name: string; task: string; rework: number; reach: number; bad: boolean; done: boolean; crateId?: number; agentId?: string }
export interface FunnelView { title: string; done: number; total: number; branches: FunnelBranch[] }
export interface ReplayView { index: number; total: number; item: FeedItem | null }

export interface HudState {
  mode: BaseMode;
  alerts: Decision[];
  clock: number;
  pressure: number;
  streak: number;
  xp: number;
  level: number;
  speed: number;
  paused: boolean;
  awaiting: number;
  elsewhere: number;
  finished: number;
  agentsShown: number;
  sectors: SectorRow[];
  dim: SectorId | null;
  wings: { id: string; name: string }[];
  tickets: Ticket[];
  inspect: InspectView | null;
  journey: JourneyView | null;
  funnel: FunnelView | null;
  feed: FeedItem[];
  rules: string[];
  ruleOffer: RuleOffer | null;
  toast: string;
  since: SinceSummary | null;
  end: EndSummary | null;
  composer: boolean;
  history: boolean;
  pins: { id: string; name: string }[];
  sound: SoundPack;
  replay: ReplayView | null;
  focused: boolean;
}
export type { LogLine };

export const emptyHud = (mode: BaseMode): HudState => ({
  mode, alerts: [], clock: 0, pressure: 0, streak: 0, xp: 0, level: 1, speed: 1, paused: false, awaiting: 0, elsewhere: 0, finished: 0, agentsShown: 0, sectors: [], dim: null, wings: [], tickets: [],
  inspect: null, journey: null, funnel: null, feed: [], rules: [], ruleOffer: null, toast: '', since: null, end: null, composer: false, history: false, pins: [], sound: 'off', replay: null, focused: false,
});

export const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
