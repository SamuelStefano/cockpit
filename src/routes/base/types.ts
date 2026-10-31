export type BaseMode = 'live' | 'practice';
export type AgentState = 'working' | 'thinking' | 'blocked' | 'silent' | 'paused' | 'waiting' | 'reviewing' | 'asleep' | 'finished';
export type ModelFamily = 'opus' | 'sonnet' | 'haiku' | 'grok' | 'codex' | 'unknown';
export type SectorId = 'intake' | 'build' | 'ship' | 'ops' | 'archive';
export type MonitorTab = 'split' | 'preview' | 'diff' | 'terminal' | 'trace';

export interface Point { x: number; z: number }
export interface Wing { id: string; name: string; hotkey?: string; cx: number; width: number; colStart: number; cols: number; rug: number; count: number }
export interface LogLine { t: number; msg: string }

export interface FloorAgent {
  id: string;
  name: string;
  family: ModelFamily;
  modelLabel: string;
  wingId: string;
  sector: SectorId;
  x: number;
  z: number;
  state: AgentState;
  line: string;
  sessionId?: string;
  ctx: number | null;
  phase: number;
  cheer?: boolean;
  monitor: MonitorData;
}

export type MonitorData =
  | { kind: 'practice'; file: string; key: string; progress: number; hasJob: boolean; tab: MonitorTab; term: string[]; log: LogLine[]; now: string; next: string; preview: number }
  | { kind: 'live'; title: string; tail: string | null; now: string };

export interface FloorCrate {
  id: string;
  title: string;
  x: number;
  y: number;
  z: number;
  band?: boolean;
  flag?: boolean;
  star?: boolean;
  held?: boolean;
}

export interface FloorPacket { id: number; x: number; y: number; z: number; color: number }
export interface FloorArc { from: Point; to: Point }
export interface Station { id: string; label: string; x: number }

// What the renderer needs each frame, from either mode. LIVE only ever fills it with client state.
export interface Floor {
  agents: FloorAgent[];
  wings: Wing[];
  crates: FloorCrate[];
  packets: FloorPacket[];
  arcs: FloorArc[];
  stations: Station[];
  mountainCount: number;
  mountainLabel: string;
  gateBarsUp: boolean;
  machineOk: boolean | null;
  machineSpin: boolean;
  machineLabel: string;
  racks: { name: string; disk: number | null; label: string }[];
  clockLabel: string;
  postBoard: number | null;
  beltMoving: boolean;
}

export type RiskLevel = 'UNSAFE' | 'MAYBE';
export interface DecisionOption { label: string; hint: string; rec?: boolean }
export interface Decision {
  id: string;
  type: string;
  title: string;
  what: string;
  why: string;
  risk?: RiskLevel;
  deadline?: number;
  born: number;
  pos: Point;
  focusAgentId?: string;
  opts: DecisionOption[];
}

export interface SectorRow { id: SectorId; name: string; hotkey: string; color: string; busy: number; stuck: number; waiting: number }
