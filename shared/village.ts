export const VILLAGE_DEFAULT_DAILY_CAP = 6;
export const VILLAGE_MAX_DAILY_CAP = 24;
export const VILLAGE_EVENTS_CAP = 50;
export const VILLAGE_TURN_DAYS = 7;

export interface VillageEvent { at: number; type: 'claim' | 'release'; botId: string; taskId: string; reason?: string }
export interface VillageState {
  dailyCap: number;
  turns: Record<string, Record<string, number>>;
  events: VillageEvent[];
}

export interface VillageView {
  dailyCap: number;
  paused: boolean;
  claimed: { botId: string; taskId: string }[];
  events: { at: number; type: VillageEvent['type']; botId: string; taskId: string }[];
}

export function clampDailyCap(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= VILLAGE_MAX_DAILY_CAP ? v : null;
}
