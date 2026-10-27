import { isBoxId, sanitizeBoxLabel, type BoxInfo, type BoxesFrame } from '../../shared/boxes';
import type { ClientMsg } from '../../shared/protocol';
import { loadPref, savePref, removePref } from '../lib/persist';
import { toast } from '../components/primitives/toast-bus';

// The box this device talks to is a per-device choice (localStorage), never an
// account pref: syncing it would flip every other device to this one's box.
export const BOX_PREF = 'relay.box';
const MAX_BOXES = 50;

export interface DialDecision {
  pref: string | null;
}

// Pure: given the saved box and a fresh `boxes` frame, which box should this
// device dial from now on. A saved box that left the list was revoked; with no
// saved box the relay's primary becomes the choice, so the UI never stays unbound.
export function nextDial(pref: string | null, frame: BoxesFrame): DialDecision {
  if (pref && !frame.boxes.some((b) => b.id === pref)) return { pref: null };
  if (!pref && frame.primary && frame.boxes.some((b) => b.id === frame.primary)) return { pref: frame.primary };
  return { pref };
}

export function readPref(): string | null {
  const v = loadPref<string>(BOX_PREF, '');
  return isBoxId(v) ? v.toLowerCase() : null;
}

// Relay metadata is untrusted: re-validate ids and labels before they render.
export function parseBoxes(m: Record<string, unknown>): BoxesFrame | null {
  if (!Array.isArray(m.boxes)) return null;
  const boxes: BoxInfo[] = [];
  for (const raw of m.boxes.slice(0, MAX_BOXES)) {
    const b = raw as Partial<BoxInfo> | null;
    if (!b || !isBoxId(b.id)) continue;
    boxes.push({
      id: b.id.toLowerCase(),
      label: sanitizeBoxLabel(b.label),
      online: b.online === true,
      lastSeen: typeof b.lastSeen === 'string' ? b.lastSeen : null,
    });
  }
  const id = (v: unknown) => (isBoxId(v) ? v.toLowerCase() : null);
  return { t: 'boxes', box: id(m.box), primary: id(m.primary), boxes };
}

interface State {
  frame: BoxesFrame | null;
  pref: string | null;
}

let state: State = { frame: null, pref: readPref() };
const listeners = new Set<() => void>();

function set(next: State): void {
  state = next;
  for (const fn of listeners) fn();
}

export const boxStore = {
  get: () => state,
  subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },

  applyFrame(m: Record<string, unknown>): void {
    const frame = parseBoxes(m);
    if (!frame) return;
    const { pref } = nextDial(state.pref, frame);
    if (pref !== state.pref) this.setPref(pref, frame);
    else set({ ...state, frame });
  },

  setPref(pref: string | null, frame: BoxesFrame | null = state.frame): void {
    if (pref) savePref(BOX_PREF, pref); else removePref(BOX_PREF);
    set({ frame, pref });
  },

  dropPref(): void {
    this.setPref(null, null);
  },

  applyError(m: Record<string, unknown>): void {
    toast(m.op === 'box-revoke' ? 'Não foi possível remover a máquina.' : 'Não foi possível renomear a máquina.', { tone: 'error' });
  },

  reset(): void {
    state = { frame: null, pref: readPref() };
    for (const fn of listeners) fn();
  },
};

export function currentBoxId(s: State = state): string | null {
  return s.pref ?? s.frame?.box ?? s.frame?.primary ?? null;
}

export function boxLabel(b: Pick<BoxInfo, 'id' | 'label'>): string {
  return b.label || `${b.id.slice(0, 8)} · sem nome`;
}

export function rosterMsg(s: State = state): Extract<ClientMsg, { t: 'box-roster' }> | null {
  if (!s.frame) return null;
  const self = currentBoxId(s);
  return { t: 'box-roster', boxes: s.frame.boxes.map((b) => ({ label: boxLabel(b), online: b.online, self: b.id === self })) };
}
