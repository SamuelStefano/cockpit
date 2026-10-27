import { overallLevel, parseHealth, parseSmoke, type BoxHealth, type HealthItem, type SmokeResult } from '../../shared/box-health';
import { toast } from '../components/primitives/toast-bus';
import { currentBoxId } from './boxes-store';
import { deviceFrames } from './sealed-socket';

// Health reports per box. Only the box this tab is sealed to can answer, so the
// other boxes keep whatever they last reported in this tab (or nothing).
export const LOCAL_BOX = 'local';

export interface BoxHealthEntry {
  health: BoxHealth | null;
  smoke: SmokeResult | null;
}

interface State {
  byBox: Record<string, BoxHealthEntry>;
  panelOpen: boolean;
}

const EMPTY: BoxHealthEntry = { health: null, smoke: null };

// Items that just became errors: the toast fires on the transition, never again
// for an error that is still there in the next report.
export function newErrors(prev: BoxHealth | null, next: BoxHealth): HealthItem[] {
  const was = new Set(prev?.items.filter((i) => i.level === 'error').map((i) => i.id) ?? []);
  return next.items.filter((i) => i.level === 'error' && !was.has(i.id));
}

export function errorToastText(items: HealthItem[]): string {
  if (items.length === 1) return `Máquina com problema: ${items[0].label} — ${items[0].detail}`;
  return `Máquina com ${items.length} problemas: ${items.map((i) => i.label).join(', ')}`;
}

export function healthLevel(e: BoxHealthEntry | undefined) {
  return e?.health ? overallLevel(e.health.items) : null;
}

let state: State = { byBox: {}, panelOpen: false };
const listeners = new Set<() => void>();

function set(next: State): void {
  state = next;
  for (const fn of listeners) fn();
}

function patch(box: string, p: Partial<BoxHealthEntry>): void {
  const cur = state.byBox[box] ?? EMPTY;
  set({ ...state, byBox: { ...state.byBox, [box]: { ...cur, ...p } } });
}

const activeKey = () => currentBoxId() ?? LOCAL_BOX;

export const boxHealthStore = {
  get: () => state,
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  entry: (box: string | null): BoxHealthEntry => state.byBox[box ?? LOCAL_BOX] ?? EMPTY,

  applyHealth(raw: unknown, box = activeKey()): void {
    const health = parseHealth(raw);
    if (!health) return;
    const fresh = newErrors(state.byBox[box]?.health ?? null, health);
    patch(box, { health });
    if (fresh.length) {
      toast(errorToastText(fresh), { tone: 'error', durationMs: 10_000, action: { label: 'ver', onClick: () => this.openPanel() } });
    }
  },

  applySmoke(raw: Record<string, unknown>, box = activeKey()): void {
    const smoke = parseSmoke(raw);
    if (smoke) patch(box, { smoke });
  },

  requestHealth: (): boolean => deviceFrames.send({ t: 'box-health-get' }),

  requestSmoke(box = activeKey()): boolean {
    const sent = deviceFrames.send({ t: 'box-smoke-test' });
    if (sent) patch(box, { smoke: { state: 'running' } });
    return sent;
  },

  openPanel: () => set({ ...state, panelOpen: true }),
  closePanel: () => set({ ...state, panelOpen: false }),

  reset(): void {
    set({ byBox: {}, panelOpen: false });
  },
};
