import { describe, it, expect, beforeEach } from 'vitest';
import { setupChecklist, findNewBox, setupWatch, SLOW_PAIR_MS, type ChecklistInput, type SetupWatch } from './setup-watch';
import type { BoxInfo } from '../../shared/boxes';
import type { BoxHealth } from '../../shared/box-health';

const OLD = '11111111-1111-4111-8111-111111111111';
const NEW = '22222222-2222-4222-8222-222222222222';
const box = (id: string, online = true, label = ''): BoxInfo => ({ id, label, online, lastSeen: null });
const watch = (over: Partial<SetupWatch> = {}): SetupWatch => ({ startedAt: 0, known: [OLD], label: 'casa', boxId: null, smokeAsked: false, ...over });
const okHealth: BoxHealth = { at: 1, items: [{ id: 'disk', label: 'Disco', level: 'ok', detail: '40 GB' }] };

function input(over: Partial<ChecklistInput> = {}): ChecklistInput {
  return { watch: watch(), boxes: [box(OLD)], active: OLD, seal: 'sealed', health: null, smoke: null, now: 1000, ...over };
}

const states = (c: ReturnType<typeof setupChecklist>) => c.steps.map((s) => s.state);

describe('findNewBox', () => {
  it('ignores boxes the account already had', () => {
    expect(findNewBox(watch(), [box(OLD)])).toBeNull();
    expect(findNewBox(watch(), [box(OLD), box(NEW)])?.id).toBe(NEW);
  });
  it('follows the bound box once known', () => {
    expect(findNewBox(watch({ boxId: NEW, known: [] }), [box(OLD), box(NEW)])?.id).toBe(NEW);
  });
  it('is null before the first boxes frame', () => {
    expect(findNewBox(watch(), null)).toBeNull();
  });
});

describe('setupChecklist', () => {
  it('waits for the machine, then flags a slow install with the commands to run', () => {
    const c = setupChecklist(input());
    expect(c.phase).toBe('waiting');
    expect(states(c)).toEqual(['active', 'pending', 'pending', 'pending', 'pending']);
    const slow = setupChecklist(input({ now: SLOW_PAIR_MS + 1 }));
    expect(slow.steps[0].state).toBe('warn');
    expect(slow.steps[0].hint).toContain('journalctl');
  });

  it('fails when the box paired but is offline', () => {
    const c = setupChecklist(input({ boxes: [box(OLD), box(NEW, false)] }));
    expect(c.phase).toBe('failed');
    expect(c.steps[1]).toMatchObject({ id: 'relay', state: 'error' });
  });

  it('asks to switch when the new box is not the one this tab is sealed to', () => {
    const c = setupChecklist(input({ boxes: [box(OLD), box(NEW, true, 'vps-2')] }));
    expect(c.phase).toBe('switch');
    expect(c.box?.id).toBe(NEW);
    expect(c.title).toContain('vps-2');
  });

  it('shows the enrollment hint when the box does not know this browser', () => {
    const c = setupChecklist(input({ boxes: [box(NEW)], active: NEW, seal: 'enroll' }));
    expect(c.phase).toBe('failed');
    expect(c.steps[2].hint).toContain('deck-agent enroll-device');
  });

  it('waits for the sealed channel, then for the health report', () => {
    expect(setupChecklist(input({ boxes: [box(NEW)], active: NEW, seal: 'connecting' })).title).toMatch(/canal cifrado/);
    const c = setupChecklist(input({ boxes: [box(NEW)], active: NEW }));
    expect(c.phase).toBe('progress');
    expect(states(c)).toEqual(['ok', 'ok', 'ok', 'active', 'pending']);
  });

  it('fails on a blocking health error and lists the problems', () => {
    const health: BoxHealth = { at: 1, items: [
      { id: 'claude-cli', label: 'Claude Code CLI', level: 'error', detail: 'antigo', hint: 'atualize' },
      { id: 'disk', label: 'Disco', level: 'warn', detail: '3 GB' },
    ] };
    const c = setupChecklist(input({ boxes: [box(NEW)], active: NEW, health }));
    expect(c.phase).toBe('failed');
    expect(c.problems.map((p) => p.id)).toEqual(['claude-cli', 'disk']);
    expect(c.needsSmoke).toBe(false);
  });

  it('asks for the smoke prompt once the box is healthy', () => {
    const c = setupChecklist(input({ boxes: [box(NEW)], active: NEW, health: okHealth }));
    expect(c.needsSmoke).toBe(true);
    expect(setupChecklist(input({ watch: watch({ smokeAsked: true }), boxes: [box(NEW)], active: NEW, health: okHealth })).needsSmoke).toBe(false);
  });

  it('fails with the real error when the smoke prompt fails', () => {
    const c = setupChecklist(input({ boxes: [box(NEW)], active: NEW, health: okHealth, smoke: { state: 'done', ok: false, error: 'unknown option', hint: 'atualize o CLI' } }));
    expect(c.phase).toBe('failed');
    expect(c.steps[4].hint).toBe('unknown option — atualize o CLI');
  });

  it('is ready with the box label once a real prompt answered', () => {
    const c = setupChecklist(input({ boxes: [box(NEW, true, 'vps-casa')], active: NEW, health: okHealth, smoke: { state: 'done', ok: true, ms: 2300 } }));
    expect(c.phase).toBe('ready');
    expect(c.title).toBe('vps-casa está pronta para usar');
    expect(states(c)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
    expect(c.steps[4].label).toContain('2.3s');
  });

  it('falls back to the label typed at pairing', () => {
    const c = setupChecklist(input({ boxes: [box(NEW)], active: NEW, health: okHealth, smoke: { state: 'done', ok: true } }));
    expect(c.title).toBe('casa está pronta para usar');
  });
});

describe('setupWatch', () => {
  beforeEach(() => setupWatch.stop());

  it('keeps the known boxes of the first copy when copied again', () => {
    setupWatch.start([OLD], 'a', 100);
    setupWatch.start([OLD, NEW], 'b', 200);
    expect(setupWatch.get()).toMatchObject({ known: [OLD], label: 'b', startedAt: 100 });
  });

  it('binds the new box and remembers the smoke request', () => {
    setupWatch.start([], '', 100);
    setupWatch.bind(NEW);
    setupWatch.markSmokeAsked();
    expect(setupWatch.get()).toMatchObject({ boxId: NEW, smokeAsked: true });
  });
});
