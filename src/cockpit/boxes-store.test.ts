// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import type { BoxesFrame } from '../../shared/boxes';
import { nextDial, boxStore, parseBoxes, boxLabel, currentBoxId, rosterMsg, BOX_PREF } from './boxes-store';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const frame = (over: Partial<BoxesFrame> = {}): BoxesFrame => ({
  t: 'boxes', box: null, primary: A,
  boxes: [{ id: A, label: 'VPS', online: true, lastSeen: null }, { id: B, label: '', online: false, lastSeen: null }],
  ...over,
});

beforeEach(() => { localStorage.clear(); boxStore.reset(); });

describe('nextDial', () => {
  it('adopts the primary when there is no saved box', () => {
    expect(nextDial(null, frame())).toEqual({ pref: A });
  });
  it('stays unbound while the primary is unknown', () => {
    expect(nextDial(null, frame({ primary: null }))).toEqual({ pref: null });
  });
  it('keeps a saved box that is still listed', () => {
    expect(nextDial(B, frame())).toEqual({ pref: B });
  });
  it('drops a saved box that left the list', () => {
    expect(nextDial('33333333-3333-4333-8333-333333333333', frame())).toEqual({ pref: null });
  });
});

describe('boxStore', () => {
  it('saves the primary as the pref on the first frame', () => {
    boxStore.applyFrame(frame() as unknown as Record<string, unknown>);
    expect(boxStore.get().pref).toBe(A);
    expect(JSON.parse(localStorage.getItem(`cockpit:${BOX_PREF}`)!)).toBe(A);
  });
  it('dropPref forgets the saved box', () => {
    boxStore.setPref(A);
    boxStore.dropPref();
    expect(boxStore.get().pref).toBeNull();
    expect(localStorage.getItem(`cockpit:${BOX_PREF}`)).toBeNull();
  });
  it('ignores malformed ids and sanitizes labels from the relay', () => {
    const f = parseBoxes({ boxes: [{ id: 'nope', label: 'x' }, { id: A, label: 'a‮b', online: true }] })!;
    expect(f.boxes).toHaveLength(1);
    expect(f.boxes[0].label).toBe('a b');
  });
  it('current box prefers the saved one', () => {
    boxStore.applyFrame(frame({ box: B }) as unknown as Record<string, unknown>);
    boxStore.setPref(B);
    expect(currentBoxId()).toBe(B);
  });
});

describe('boxLabel', () => {
  it('falls back to the short id for an unnamed box', () => {
    expect(boxLabel({ id: B, label: '' })).toBe('22222222 · sem nome');
  });
});

describe('rosterMsg', () => {
  it('is null before the first boxes frame', () => {
    expect(rosterMsg()).toBeNull();
  });
  it('marks the box this tab talks to and names unnamed boxes', () => {
    boxStore.applyFrame(frame() as unknown as Record<string, unknown>);
    expect(rosterMsg()).toEqual({ t: 'box-roster', boxes: [
      { label: 'VPS', online: true, self: true },
      { label: `${B.slice(0, 8)} · sem nome`, online: false, self: false },
    ] });
  });
});
