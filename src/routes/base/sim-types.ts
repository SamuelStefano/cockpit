import type { Decision, DecisionOption, LogLine, ModelFamily, MonitorTab, Point, Station, Wing, AgentState } from './types';

export interface Job {
  prompt: SimPrompt;
  task: string;
  pr: string;
  file: string;
  dur: number;
  to?: number;
  stage: string;
  a?: SimAgent;
  crate?: Crate;
  needsGate?: boolean;
  risky?: boolean;
  lost?: boolean;
  deployStuck?: boolean;
  conflicted?: boolean;
  tired?: boolean;
  rework?: number;
  tests?: string;
}
export type JobSpec = Omit<Job, 'prompt' | 'stage'>;

export interface SimAgent {
  id: string;
  name: string;
  family: ModelFamily;
  wing: Wing | null;
  planner: boolean;
  x: number;
  z: number;
  progress: number;
  job: Job | null;
  queue: Job[];
  paused: boolean;
  blockers: Set<string>;
  silent: boolean;
  asleep: boolean;
  planning: { t: number; dur: number; p: SimPrompt } | null;
  phase: number;
  log: LogLine[];
  next: string;
  tab: MonitorTab;
  ctx: number;
  supervised: boolean;
  tool: string;
  toolT: number;
  term: string[];
  state: AgentState;
  cheerUntil: number;
  stunUntil: number;
  ctxAsked: boolean;
}

export interface SimPrompt { id: number; title: string; wingId: string; t: number; jobs: Job[]; planDur?: number }

export interface Crate {
  id: number;
  a: SimAgent;
  job: Job;
  title: string;
  file: string;
  x: number;
  y: number;
  z: number;
  stage: number;
  wait: number;
  flying: number;
  status: string;
  trail: { t: number; what: string }[];
  held?: boolean;
  done?: boolean;
  cleared?: boolean;
  tainted?: boolean;
  broke?: boolean;
  deployAsked?: boolean;
  band?: boolean;
  flag?: boolean;
  star?: boolean;
}

export interface Packet { id: number; from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number }; t: number; dur: number; color: number; then?: () => void }
export interface SimOption extends DecisionOption { fn: () => void }
export interface SimAlert extends Omit<Decision, 'opts'> { opts: SimOption[] }
export type AlertDef = Pick<SimAlert, 'title' | 'what' | 'why' | 'risk' | 'deadline' | 'opts'>;
export interface FeedItem { t: number; msg: string; kind: 'info' | 'alert' | 'you' | 'rule' | 'good' | 'bad'; pos: Point | null }
export interface ConflictArc { a: SimAgent; b: SimAgent }
export interface RuleOffer { type: string; index: number; title: string; label: string }

export type Fx =
  | { kind: 'burst'; x: number; y: number; z: number; color: number; n: number; up: number }
  | { kind: 'shake'; v: number }
  | { kind: 'pop'; agentId: string; k: number }
  | { kind: 'beep'; f: number; d: number; wave?: OscillatorType; v?: number }
  | { kind: 'chord'; fs: number[] }
  | { kind: 'cable'; agentId: string }
  | { kind: 'walk'; agentId: string; to: Point }
  | { kind: 'toast'; text: string }
  | { kind: 'ping'; pos: Point };

export interface EndSummary { rank: string; score: number; prs: number; time: number; peak: number; handled: number; auto: number; regressions: number; missed: boolean; best: number; rules: number }
export interface SinceSummary { verified: number; waiting: number; lost: number; rules: number; pressure: number; items: FeedItem[]; t0: number }

export const STATIONS_PRACTICE: (Station & { wait: number })[] = [
  { id: 'tests', label: 'TESTS', x: -32, wait: 3 },
  { id: 'review', label: 'REVIEW', x: -16, wait: 3 },
  { id: 'gate', label: 'GATE', x: 0, wait: 0.5 },
  { id: 'merged', label: 'MERGED', x: 16, wait: 1.5 },
  { id: 'deployed', label: 'DEPLOYED', x: 30, wait: 2.5 },
  { id: 'verified', label: 'VERIFIED', x: 44, wait: 2 },
];
export const BELT = { z: 9, x0: -44, x1: 52 };
export const SPOTS = {
  gate: { x: -65, z: -8 },
  planner: { x: -54, z: -5 },
  post: { x: -63, z: 5 },
  machine: { x: 53, z: -10 },
  rack: { x: 50, z: -1 },
};
export const COLORS = { gold: 0xe2b23c, paper: 0xf4ead6, red: 0xd2402f, wood: 0xa8744a };
