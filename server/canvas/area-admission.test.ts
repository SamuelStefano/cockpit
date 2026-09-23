import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AREA_ADMISSION_TTL_MS, getAreaAdmissionState, parseAreaAdmissionFile, resetAreaAdmissionForTest,
  setAreaAdmissionState, waitForPendingReadForTest, writeAreaAdmissionFile,
} from './area-admission';

describe('parseAreaAdmissionFile', () => {
  const now = 10_000_000;

  it('reads a fresh, well-formed file', () => {
    const raw = JSON.stringify({ at: now - 1000, blockedAreas: ['deck', 'dfl'], lastAreaOfKey: { 'cron-1': { area: 'deck', at: now - 1000 } } });
    const parsed = parseAreaAdmissionFile(raw, now);
    expect(parsed?.blockedAreas).toEqual(new Set(['deck', 'dfl']));
    expect(parsed?.lastAreaOfKey.get('cron-1')).toEqual({ area: 'deck', at: now - 1000 });
  });

  it('fails open on stale (older than the TTL)', () => {
    const raw = JSON.stringify({ at: now - AREA_ADMISSION_TTL_MS - 1, blockedAreas: ['deck'], lastAreaOfKey: {} });
    expect(parseAreaAdmissionFile(raw, now)).toBeUndefined();
  });

  it('accepts exactly at the TTL boundary', () => {
    const raw = JSON.stringify({ at: now - AREA_ADMISSION_TTL_MS, blockedAreas: ['deck'], lastAreaOfKey: {} });
    expect(parseAreaAdmissionFile(raw, now)).toBeDefined();
  });

  it('fails open on a timestamp from the future beyond clock-skew tolerance (clock jump)', () => {
    const raw = JSON.stringify({ at: now + 6000, blockedAreas: ['deck'], lastAreaOfKey: {} });
    expect(parseAreaAdmissionFile(raw, now)).toBeUndefined();
  });

  it('tolerates a few seconds of ordinary clock skew from the future', () => {
    const raw = JSON.stringify({ at: now + 2000, blockedAreas: ['deck'], lastAreaOfKey: {} });
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

  it('drops a lastAreaOfKey entry missing `area` or `at` instead of throwing', () => {
    const raw = JSON.stringify({ at: now, blockedAreas: [], lastAreaOfKey: { bad1: { area: 'deck' }, bad2: { at: 1 }, ok: { area: 'deck', at: 1 } } });
    const parsed = parseAreaAdmissionFile(raw, now);
    expect([...parsed!.lastAreaOfKey.keys()]).toEqual(['ok']);
  });
});

describe('setAreaAdmissionState / getAreaAdmissionState — writer process', () => {
  beforeEach(() => {
    resetAreaAdmissionForTest();
    process.env.COCKPIT_CANVAS_AREA_ADMISSION = join(mkdtempSync(join(tmpdir(), 'canvas-area-admission-')), 'state.json');
  });

  it('a process that ever calls setAreaAdmissionState reads its own state straight back, no disk round-trip needed', () => {
    setAreaAdmissionState({ blockedAreas: new Set(['deck']), lastAreaOfKey: new Map([['cron-1', { area: 'deck', at: 1 }]]) });
    const s = getAreaAdmissionState();
    expect(s.blockedAreas.has('deck')).toBe(true);
    expect(s.lastAreaOfKey.get('cron-1')).toEqual({ area: 'deck', at: 1 });
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
    await writeAreaAdmissionFile({ blockedAreas: new Set(['itera']), lastAreaOfKey: new Map([['cron-x', { area: 'itera', at: 1 }]]) });
    const raw = await readFile(process.env.COCKPIT_CANVAS_AREA_ADMISSION!, 'utf8');
    const parsed = parseAreaAdmissionFile(raw, Date.now());
    expect(parsed?.blockedAreas.has('itera')).toBe(true);
    expect(parsed?.lastAreaOfKey.get('cron-x')).toEqual({ area: 'itera', at: 1 });
  });

  it('a reader process (never called setAreaAdmissionState) picks up a state file written by someone else', async () => {
    // Simulates the actual cross-process case: the file on disk was produced
    // by writeAreaAdmissionFile (the agent process's loop) — this "reader"
    // process only ever calls getAreaAdmissionState.
    await writeAreaAdmissionFile({ blockedAreas: new Set(['pessoal']), lastAreaOfKey: new Map([['cron-y', { area: 'pessoal', at: 1 }]]) });
    expect(getAreaAdmissionState().blockedAreas.size).toBe(0); // first call: stale-cache miss triggers a background read, doesn't block
    await waitForPendingReadForTest(); // deterministic: await the EXACT read just triggered, not a guessed sleep
    const s = getAreaAdmissionState();
    expect(s.blockedAreas.has('pessoal')).toBe(true);
    expect(s.lastAreaOfKey.get('cron-y')).toEqual({ area: 'pessoal', at: 1 });
  });
});
