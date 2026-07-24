import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// COCKPIT_PARKED é lido no import (const PARKED_PATH), então fixamos o caminho ANTES
// de importar o módulo e isolamos os casos apagando esse arquivo entre eles — as ops
// leem/escrevem disco a cada chamada (fonte de verdade cross-process).
const DIR = mkdtempSync(join(tmpdir(), 'parked-'));
const PARKED_FILE = join(DIR, 'parked.json');
const PAUSE_FILE = join(DIR, 'queue-paused.json');
process.env.COCKPIT_PARKED = PARKED_FILE;
process.env.COCKPIT_QUEUE_PAUSE = PAUSE_FILE;

const mod = await import('./parked');
const { addParked, removeParked, moveParked, shiftParked, parkedHeads, parkedView, clearParked, isQueuePaused, setQueuePaused } = mod;

beforeEach(() => {
  rmSync(PARKED_FILE, { force: true });
  rmSync(PAUSE_FILE, { force: true });
});
afterAll(() => rmSync(DIR, { recursive: true, force: true }));

describe('parked fila (persistência)', () => {
  it('add/parkedView roundtrip com metadados', () => {
    const id = addParked('sess1', { prompt: 'oi', model: 'opus' });
    expect(id).toBeTruthy();
    const view = parkedView();
    expect(view).toEqual([{ sessionKey: 'sess1', id, text: 'oi', at: expect.any(Number) }]);
  });

  it('rejeita sessionKey inválida', () => {
    expect(addParked('bad key!', { prompt: 'x' })).toBeNull();
  });

  it('shiftParked drena FIFO e some do disco ao esvaziar', () => {
    addParked('s', { prompt: 'a' });
    addParked('s', { prompt: 'b' });
    expect(shiftParked('s')?.prompt).toBe('a');
    expect(shiftParked('s')?.prompt).toBe('b');
    expect(shiftParked('s')).toBeUndefined();
    expect(parkedHeads()).toEqual([]);
  });

  it('moveParked reordena e respeita bordas', () => {
    const a = addParked('s', { prompt: 'a' })!;
    addParked('s', { prompt: 'b' })!;
    const c = addParked('s', { prompt: 'c' })!;
    moveParked('s', c, -1);
    expect(parkedView().map((v) => v.text)).toEqual(['a', 'c', 'b']);
    moveParked('s', a, -1); // topo não sobe
    expect(parkedView().map((v) => v.text)).toEqual(['a', 'c', 'b']);
  });

  it('removeParked tira só o item; clearParked zera a sessão', () => {
    const a = addParked('s', { prompt: 'a' })!;
    addParked('s', { prompt: 'b' });
    removeParked('s', a);
    expect(parkedView().map((v) => v.text)).toEqual(['b']);
    clearParked('s');
    expect(parkedView()).toEqual([]);
  });
});

describe('pausa manual da fila', () => {
  it('default = não pausada (sem arquivo)', () => {
    expect(isQueuePaused()).toBe(false);
  });
  it('setQueuePaused(true) persiste e isQueuePaused reflete', () => {
    setQueuePaused(true);
    expect(isQueuePaused()).toBe(true);
    setQueuePaused(false);
    expect(isQueuePaused()).toBe(false);
  });
});
