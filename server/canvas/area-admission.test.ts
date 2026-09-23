import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AREA_ADMISSION_TTL_MS, getAreaAdmissionState, parseAreaAdmissionFile, resetAreaAdmissionForTest,
  setAreaAdmissionState, writeAreaAdmissionFile,
} from './area-admission';

describe('parseAreaAdmissionFile', () => {
  const now = 10_000_000;

  it('reads a fresh, well-formed file', () => {
    const raw = JSON.stringify({ at: now - 1000, blockedAreas: ['deck', 'dfl'], lastAreaOfKey: { 'cron-1': 'deck' } });
    const parsed = parseAreaAdmissionFile(raw, now);
    expect(parsed?.blockedAreas).toEqual(new Set(['deck', 'dfl']));
    expect(parsed?.lastAreaOfKey.get('cron-1')).toBe('deck');
  });

  it('fails open on stale (older than the TTL)', () => {
    const raw = JSON.stringify({ at: now - AREA_ADMISSION_TTL_MS - 1, blockedAreas: ['deck'], lastAreaOfKey: {} });
    expect(parseAreaAdmissionFile(raw, now)).toBeUndefined();
  });

  it('accepts exactly at the TTL boundary', () => {
    const raw = JSON.stringify({ at: now - AREA_ADMISSION_TTL_MS, blockedAreas: ['deck'], lastAreaOfKey: {} });
    expect(parseAreaAdmissionFile(raw, now)).toBeDefined();
  });

  it('fails open on corrupt JSON', () => {
    expect(parseAreaAdmissionFile('{not json', now)).toBeUndefined();
  });

  it('fails open on missing/non-numeric timestamp', () => {
    expect(parseAreaAdmissionFile(JSON.stringify({ blockedAreas: [] }), now)).toBeUndefined();
    expect(parseAreaAdmissionFile(JSON.stringify({ at: 'nope', blockedAreas: [] }), now)).toBeUndefined();
  });

  it('fails open when blockedAreas is not an array', () => {
    const raw = JSON.stringify({ at: now, blockedAreas: 'deck' });
    expect(parseAreaAdmissionFile(raw, now)).toBeUndefined();
  });

  it('tolerates a missing/malformed lastAreaOfKey — empty map, not a throw', () => {
    const raw = JSON.stringify({ at: now, blockedAreas: ['deck'] });
    expect(parseAreaAdmissionFile(raw, now)?.lastAreaOfKey.size).toBe(0);
  });
});

describe('setAreaAdmissionState / getAreaAdmissionState — writer process', () => {
  beforeEach(() => {
    resetAreaAdmissionForTest();
    process.env.COCKPIT_CANVAS_AREA_ADMISSION = join(mkdtempSync(join(tmpdir(), 'canvas-area-admission-')), 'state.json');
  });

  it('a process that ever calls setAreaAdmissionState reads its own state straight back, no disk round-trip needed', () => {
    setAreaAdmissionState({ blockedAreas: new Set(['deck']), lastAreaOfKey: new Map([['cron-1', 'deck']]) });
    const s = getAreaAdmissionState();
    expect(s.blockedAreas.has('deck')).toBe(true);
    expect(s.lastAreaOfKey.get('cron-1')).toBe('deck');
  });

  it('starts empty (fails open) before any tick/read', () => {
    expect(getAreaAdmissionState().blockedAreas.size).toBe(0);
  });
});

describe('writeAreaAdmissionFile / parseAreaAdmissionFile round-trip', () => {
  beforeEach(() => {
    resetAreaAdmissionForTest();
    process.env.COCKPIT_CANVAS_AREA_ADMISSION = join(mkdtempSync(join(tmpdir(), 'canvas-area-admission-')), 'state.json');
  });

  it('writes atomically and round-trips through parseAreaAdmissionFile', async () => {
    await writeAreaAdmissionFile({ blockedAreas: new Set(['itera']), lastAreaOfKey: new Map([['cron-x', 'itera']]) });
    const raw = await readFile(process.env.COCKPIT_CANVAS_AREA_ADMISSION!, 'utf8');
    const parsed = parseAreaAdmissionFile(raw, Date.now());
    expect(parsed?.blockedAreas.has('itera')).toBe(true);
    expect(parsed?.lastAreaOfKey.get('cron-x')).toBe('itera');
  });

  it('a reader process (never called setAreaAdmissionState) picks up a state file written by someone else', async () => {
    // Simulates the actual cross-process case: the file on disk was produced
    // by writeAreaAdmissionFile (the agent process's loop) — this "reader"
    // process only ever calls getAreaAdmissionState.
    await writeAreaAdmissionFile({ blockedAreas: new Set(['pessoal']), lastAreaOfKey: new Map([['cron-y', 'pessoal']]) });
    expect(getAreaAdmissionState().blockedAreas.size).toBe(0); // first call: stale-cache miss triggers a background read, doesn't block
    await new Promise((r) => setTimeout(r, 20)); // let the fire-and-forget read land
    const s = getAreaAdmissionState();
    expect(s.blockedAreas.has('pessoal')).toBe(true);
    expect(s.lastAreaOfKey.get('cron-y')).toBe('pessoal');
  });
});
