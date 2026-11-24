import { describe, it, expect, beforeEach, vi } from 'vitest';
import { boxHealthStore, newErrors, errorToastText, healthLevel } from './box-health-store';
import { subscribeToast, type ToastItem } from '../components/primitives/toast-bus';
import type { BoxHealth, HealthItem } from '../../shared/box-health';

const item = (id: HealthItem['id'], level: HealthItem['level']): HealthItem => ({ id, label: id, level, detail: 'd' });
const report = (...items: HealthItem[]): BoxHealth => ({ at: 1, items });
const BOX = '22222222-2222-4222-8222-222222222222';

describe('newErrors', () => {
  it('returns only items that turned into errors', () => {
    const prev = report(item('disk', 'error'), item('pty', 'ok'));
    const next = report(item('disk', 'error'), item('pty', 'error'), item('node', 'warn'));
    expect(newErrors(prev, next).map((i) => i.id)).toEqual(['pty']);
  });
  it('treats every error as new on the first report', () => {
    expect(newErrors(null, report(item('disk', 'error'))).length).toBe(1);
  });
});

describe('errorToastText', () => {
  it('names one problem with its detail, several by label', () => {
    expect(errorToastText([item('disk', 'error')])).toBe('Máquina com problema: disk — d');
    expect(errorToastText([item('disk', 'error'), item('pty', 'error')])).toBe('Máquina com 2 problemas: disk, pty');
  });
});

describe('boxHealthStore', () => {
  beforeEach(() => boxHealthStore.reset());

  it('toasts once when a box turns unhealthy, not on every report', () => {
    const seen: ToastItem[] = [];
    const off = subscribeToast((t) => seen.push(t));
    boxHealthStore.applyHealth(report(item('disk', 'ok')), BOX);
    boxHealthStore.applyHealth(report(item('disk', 'error')), BOX);
    boxHealthStore.applyHealth(report(item('disk', 'error')), BOX);
    off();
    expect(seen).toHaveLength(1);
    expect(seen[0].tone).toBe('error');
    expect(healthLevel(boxHealthStore.entry(BOX))).toBe('error');
  });

  it('opens the panel from the toast action', () => {
    const fn = vi.fn();
    const off = subscribeToast((t) => { t.action?.onClick(); fn(); });
    boxHealthStore.applyHealth(report(item('node', 'error')), BOX);
    off();
    expect(fn).toHaveBeenCalled();
    expect(boxHealthStore.get().panelOpen).toBe(true);
  });

  it('ignores malformed reports and smoke frames', () => {
    boxHealthStore.applyHealth({ items: 'nope' }, BOX);
    boxHealthStore.applySmoke({ state: 'weird' }, BOX);
    expect(boxHealthStore.entry(BOX)).toEqual({ health: null, smoke: null });
  });

  it('keeps the smoke result per box', () => {
    boxHealthStore.applySmoke({ state: 'done', ok: true, ms: 900 }, BOX);
    expect(boxHealthStore.entry(BOX).smoke).toEqual({ state: 'done', ok: true, ms: 900 });
    expect(boxHealthStore.entry(null).smoke).toBeNull();
  });
});
