export type GameEventType =
  | 'turn_done' | 'turn_error' | 'message_sent' | 'session_new'
  | 'route_visit' | 'palette_open' | 'egg_found' | 'fish_caught'
  | 'pr_merged' | 'task_done';

export interface GameEvent {
  type: GameEventType;
  route?: string;
  egg?: string;
  // A fish_caught that was the rare star.
  rare?: boolean;
  // Turns running at the same time when this one finished (multitasker).
  concurrent?: number;
  // Same key within a few seconds counts once (replayed `done` after a reconnect).
  key?: string;
}

export interface GameState {
  v: 1;
  xp: number;
  totals: Record<string, number>;
  streak: { current: number; best: number; lastDay: string };
  unlocked: Record<string, string>;
  daily: { day: string; progress: Record<string, number>; done: string[]; bonus: boolean; msgXp: number };
  eggs: string[];
  routes: string[];
  lastError: boolean;
  once: Record<string, string>;
}

export type Reward =
  | { kind: 'xp'; amount: number; source: GameEventType }
  | { kind: 'level'; level: number; title: string }
  | { kind: 'achievement'; id: string }
  | { kind: 'quest'; id: string; bonus?: boolean }
  | { kind: 'streak'; days: number };

export interface EventCtx {
  event: GameEvent;
  now: Date;
}
