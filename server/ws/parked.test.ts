import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// COCKPIT_PARKED é lido no import (const PARKED_PATH), então fixamos o caminho ANTES
// de importar o módulo e isolamos os casos apagando esse arquivo entre eles — as ops
// leem/escrevem disco a cada chamada (fonte de verdade cross-process).
const DIR = mkdtempSync(join(tmpdir(), 'parked-'));
const PARKED_FILE = join(DIR, 'parked.json');
process.env.COCKPIT_PARKED = PARKED_FILE;

const mod = await import('./parked');
const { addParked, removeParked, moveParked, shiftParked, parkedHeads, parkedView, clearParked, computePaused, underWindowCap, noteWindowDrain, windowState, resetWindowState, WINDOW_CAP } = mod;

beforeEach(() => {
  rmSync(PARKED_FILE, { force: true });
  resetWindowState();
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

describe('computePaused', () => {
  const now = 1_000_000;
  it('fiveHour esgotado antes do reset = pausado', () => {
    expect(computePaused({ fiveHour: 99.9, resetsAt: now + 1000 } as any, null, now)).toBe(true);
  });
  it('reset já passou = não pausado mesmo com fiveHour alto', () => {
    expect(computePaused({ fiveHour: 99.9, resetsAt: now - 1 } as any, null, now)).toBe(false);
  });
  it('rate limitado com reset futuro = pausado', () => {
    expect(computePaused(null, { resetsAt: now + 1000, status: 'rejected' }, now)).toBe(true);
  });
  it('tudo liberado = não pausado', () => {
    expect(computePaused({ fiveHour: 10, resetsAt: now + 1000 } as any, { resetsAt: 0, status: 'allowed' }, now)).toBe(false);
  });
});

describe('teto por janela', () => {
  it('conta drenos até o teto e reseta ao trocar de janela', () => {
    const w1 = { resetsAt: 111 } as any;
    for (let i = 0; i < WINDOW_CAP; i++) {
      expect(underWindowCap(w1)).toBe(true);
      noteWindowDrain(w1);
    }
    expect(underWindowCap(w1)).toBe(false);
    expect(windowState().count).toBe(WINDOW_CAP);
    const w2 = { resetsAt: 222 } as any; // nova janela (resetsAt diferente)
    expect(underWindowCap(w2)).toBe(true);
    expect(windowState().count).toBe(0);
  });
});
