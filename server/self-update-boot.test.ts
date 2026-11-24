import { describe, it, expect } from 'vitest';
import {
  MAX_BOOTS, CONFIRM_UPTIME_MS, addBad, badFile, bootConfirmer, checkBootAfterUpdate, markerFile, readBad, readMarker, writeMarker,
  type BootDeps,
} from './self-update-boot';

const DIR = '/agent';
const FROM = 'a'.repeat(40);
const TO = 'b'.repeat(40);

function harness(o: { head?: string; depsChanged?: boolean; resetOk?: boolean; npmOk?: boolean } = {}) {
  const files = new Map<string, string>();
  const calls: string[] = [];
  const logs: string[] = [];
  const d: BootDeps = {
    read: (f) => files.get(f) ?? null,
    write: (f, data) => { files.set(f, data); },
    remove: (f) => { files.delete(f); },
    git: (args) => {
      calls.push(`git ${args.join(' ')}`);
      if (args[0] === 'rev-parse') return `${o.head ?? TO}\n`;
      if (args[0] === 'diff') return o.depsChanged ? 'package-lock.json\n' : '';
      if (args[0] === 'reset') return o.resetOk === false ? false : '';
      return '';
    },
    npmCi: () => { calls.push('npm ci'); return o.npmOk ?? true; },
    log: (m) => logs.push(m),
  };
  return { d, files, calls, logs };
}

describe('boot check after a self-update', () => {
  it('does nothing without a marker', () => {
    const h = harness();
    expect(checkBootAfterUpdate(h.d, DIR)).toBe('none');
    expect(h.calls).toEqual([]);
  });

  it('counts each boot on the new commit', () => {
    const h = harness();
    writeMarker(h.d, DIR, { from: FROM, to: TO, boots: 0 });
    expect(checkBootAfterUpdate(h.d, DIR)).toBe('counted');
    expect(readMarker(h.d, DIR)).toEqual({ from: FROM, to: TO, boots: 1 });
  });

  it('drops a marker that no longer matches HEAD', () => {
    const h = harness({ head: 'c'.repeat(40) });
    writeMarker(h.d, DIR, { from: FROM, to: TO, boots: 2 });
    expect(checkBootAfterUpdate(h.d, DIR)).toBe('stale');
    expect(h.files.has(markerFile(DIR))).toBe(false);
  });

  it('drops a corrupt marker', () => {
    const h = harness();
    h.files.set(markerFile(DIR), '{"from":"x"');
    expect(checkBootAfterUpdate(h.d, DIR)).toBe('none');
    expect(h.files.has(markerFile(DIR))).toBe(false);
  });

  it(`rolls back after ${MAX_BOOTS} boots that never confirmed, and never retries that commit`, () => {
    const h = harness();
    writeMarker(h.d, DIR, { from: FROM, to: TO, boots: 0 });
    for (let i = 0; i < MAX_BOOTS; i++) expect(checkBootAfterUpdate(h.d, DIR)).toBe('counted');
    expect(checkBootAfterUpdate(h.d, DIR)).toBe('rolled-back');
    expect(h.calls).toContain(`git reset -q --hard ${FROM}`);
    expect(h.calls).not.toContain('npm ci');
    expect(h.files.has(markerFile(DIR))).toBe(false);
    expect(readBad(h.d, DIR)).toEqual([TO]);
    expect(h.logs).toContain(`[agent] self-update: bbbbbbb failed to boot ${MAX_BOOTS}x, rolled back to aaaaaaa`);
  });

  it('reinstalls the old dependencies when the update changed them', () => {
    const h = harness({ depsChanged: true });
    writeMarker(h.d, DIR, { from: FROM, to: TO, boots: MAX_BOOTS });
    expect(checkBootAfterUpdate(h.d, DIR)).toBe('rolled-back');
    expect(h.calls.indexOf('npm ci')).toBeGreaterThan(h.calls.indexOf(`git reset -q --hard ${FROM}`));
  });

  it('logs and clears the marker when the reset itself fails', () => {
    const h = harness({ resetOk: false });
    writeMarker(h.d, DIR, { from: FROM, to: TO, boots: MAX_BOOTS });
    expect(checkBootAfterUpdate(h.d, DIR)).toBe('rollback-failed');
    expect(h.files.has(markerFile(DIR))).toBe(false);
    expect(readBad(h.d, DIR)).toEqual([TO]);
  });

  it('keeps the never-retry list bounded and free of duplicates', () => {
    const h = harness();
    for (let i = 0; i < 60; i++) addBad(h.d, DIR, i.toString(16).padStart(40, '0'));
    addBad(h.d, DIR, '0'.repeat(40));
    addBad(h.d, DIR, '0'.repeat(40));
    const list = readBad(h.d, DIR);
    expect(list).toHaveLength(50);
    expect(list.filter((s) => s === '0'.repeat(40))).toHaveLength(1);
    h.files.set(badFile(DIR), 'garbage');
    expect(readBad(h.d, DIR)).toEqual([]);
  });
});

describe('confirming an update', () => {
  it('clears the marker only after both the uptime and a relay connection', () => {
    const h = harness();
    let now = 0;
    writeMarker(h.d, DIR, { from: FROM, to: TO, boots: 1 });
    const c = bootConfirmer(h.d, DIR, 0, () => now);
    c.connected();
    expect(h.files.has(markerFile(DIR))).toBe(true);
    now = CONFIRM_UPTIME_MS - 1;
    c.check();
    expect(h.files.has(markerFile(DIR))).toBe(true);
    now = CONFIRM_UPTIME_MS;
    c.check();
    expect(h.files.has(markerFile(DIR))).toBe(false);
  });

  it('does not confirm on uptime alone', () => {
    const h = harness();
    writeMarker(h.d, DIR, { from: FROM, to: TO, boots: 1 });
    const c = bootConfirmer(h.d, DIR, 0, () => CONFIRM_UPTIME_MS * 10);
    c.check();
    expect(h.files.has(markerFile(DIR))).toBe(true);
    c.connected();
    expect(h.files.has(markerFile(DIR))).toBe(false);
  });
});
