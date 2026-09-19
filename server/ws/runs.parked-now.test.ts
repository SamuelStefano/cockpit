import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'deck-parked-'));
process.env.COCKPIT_PARKED = join(dir, 'parked.json');
process.env.COCKPIT_QUEUE_PAUSE = join(dir, 'queue-paused.json');

vi.mock('../db', () => ({ lastUsageOf: () => null }));
vi.mock('../engine/claude', () => ({
  run: vi.fn(() => ({ kill: vi.fn() })),
  resolveMcpSelection: vi.fn(() => undefined),
}));
vi.mock('./resume', () => ({ resumableId: vi.fn((id?: string) => id) }));
vi.mock('./broadcast', () => ({ broadcast: vi.fn(), send: vi.fn(), setWss: vi.fn() }));
vi.mock('./translate', () => ({ translate: vi.fn() }));
vi.mock('../summary', () => ({ summarize: vi.fn(async () => {}) }));
vi.mock('../engine/triage', () => ({ classify: vi.fn(), quickAnswer: vi.fn(), killSideRuns: vi.fn(), killSideRunsFor: vi.fn() }));
vi.mock('../engine/suggest', () => ({ suggestFollowups: vi.fn(async () => []) }));
vi.mock('./incidents', () => ({ recordIncident: vi.fn() }));
vi.mock('./recover', () => ({ markRunLive: vi.fn(), clearRunLive: vi.fn(), takeOrphanRuns: vi.fn(() => []) }));

import { startRun, runParkedNow, startParkedDrainer } from './runs';
import { threads } from './threads';
import { addParked, parkedView, clearParked } from './parked';
import { run } from '../engine/claude';

const closeLast = () => vi.mocked(run).mock.calls.at(-1)![0].onClose?.();
const ids = () => parkedView().map((p) => p.text);

describe('run-now com fila de varios itens', () => {
  beforeEach(() => {
    threads.clear();
    clearParked('s1', 'admin');
    vi.mocked(run).mockClear();
    startParkedDrainer(3_600_000);
  });

  it('mantem os demais itens da fila', () => {
    const a = addParked('s1', { prompt: 'A' }) as { id: string };
    const b = addParked('s1', { prompt: 'B' }) as { id: string };
    addParked('s1', { prompt: 'C' });
    expect(ids()).toEqual(['A', 'B', 'C']);

    startRun({ ws: null, sessionKey: 's1', prompt: 'turno em andamento' });
    expect(threads.has('s1')).toBe(true);

    const r = runParkedNow('s1', b.id);
    expect(r).toEqual({ ok: true });
    expect(ids()).toEqual(['B', 'A', 'C']);

    closeLast(); // onClose do turno morto -> drainParked
    expect(ids()).toEqual(['A', 'C']);
    expect(vi.mocked(run).mock.calls.at(-1)![0].prompt).toBe('B');
    expect(a.id).toBeTruthy();
  });

  it('idle: dispara direto sem perder os outros', () => {
    addParked('s1', { prompt: 'A' });
    const b = addParked('s1', { prompt: 'B' }) as { id: string };
    addParked('s1', { prompt: 'C' });
    expect(runParkedNow('s1', b.id)).toEqual({ ok: true });
    expect(ids()).toEqual(['A', 'C']);
    expect(vi.mocked(run).mock.calls.at(-1)![0].prompt).toBe('B');
  });

  it('turno vindo da fila: run-now nao apaga o resto', () => {
    addParked('s1', { prompt: 'A' });
    addParked('s1', { prompt: 'B' });
    addParked('s1', { prompt: 'C' });
    // drena A pelo drainer normal (o turno em andamento carrega thread.parked)
    expect(runParkedNow('s1', parkedView()[0].id)).toEqual({ ok: true });
    expect(ids()).toEqual(['B', 'C']);
    const c = parkedView()[1];
    expect(runParkedNow('s1', c.id)).toEqual({ ok: true });
    expect(ids()).toEqual(['C', 'B']);
    closeLast();
    expect(ids()).toEqual(['B']);
  });
});

process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
