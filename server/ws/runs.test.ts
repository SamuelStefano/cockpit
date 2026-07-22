import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { admitRun, findStaleThreads, startRun, threads, REAPER_SILENCE_CAP_MS, REAPER_TOTAL_CAP_MS } from './runs';
import { awaitingAnswer } from './awaiting';
import { run } from '../engine/claude';

vi.mock('../engine/claude', () => ({ run: vi.fn(() => ({ kill: vi.fn() })) }));
vi.mock('./broadcast', () => ({ broadcast: vi.fn(), send: vi.fn(), setWss: vi.fn() }));
vi.mock('./translate', () => ({ translate: vi.fn() }));
vi.mock('../summary', () => ({ summarize: vi.fn(async () => {}) }));
vi.mock('../engine/triage', () => ({ classify: vi.fn(), quickAnswer: vi.fn(), killSideRuns: vi.fn(), killSideRunsFor: vi.fn() }));
vi.mock('../engine/suggest', () => ({ suggestFollowups: vi.fn(async () => []) }));

describe('findStaleThreads', () => {
  const now = 1_000_000_000;

  it('mata turno mudo além do teto de silêncio', () => {
    const entries: [string, { startedAt: number; lastFrameAt?: number }][] = [
      ['a', { startedAt: now - 60_000, lastFrameAt: now - REAPER_SILENCE_CAP_MS - 1 }],
    ];
    expect(findStaleThreads(now, entries)).toEqual(['a']);
  });

  it('preserva turno com frame recente', () => {
    const entries: [string, { startedAt: number; lastFrameAt?: number }][] = [
      ['a', { startedAt: now - REAPER_SILENCE_CAP_MS - 1, lastFrameAt: now - 1000 }],
    ];
    expect(findStaleThreads(now, entries)).toEqual([]);
  });

  it('mata turno vivo além do teto total mesmo com frames chegando', () => {
    const entries: [string, { startedAt: number; lastFrameAt?: number }][] = [
      ['a', { startedAt: now - REAPER_TOTAL_CAP_MS - 1, lastFrameAt: now - 500 }],
    ];
    expect(findStaleThreads(now, entries)).toEqual(['a']);
  });

  it('turno sem frame algum conta silêncio desde o início', () => {
    const entries: [string, { startedAt: number; lastFrameAt?: number }][] = [
      ['fresh', { startedAt: now - 1000 }],
      ['old', { startedAt: now - REAPER_SILENCE_CAP_MS - 1 }],
    ];
    expect(findStaleThreads(now, entries)).toEqual(['old']);
  });
});

describe('admitRun', () => {
  it('admits while live runs are below the cap', () => {
    expect(admitRun(0, false, 3)).toBe(true);
    expect(admitRun(2, false, 3)).toBe(true);
  });

  it('rejects a brand-new run once the cap is reached', () => {
    expect(admitRun(3, false, 3)).toBe(false);
    expect(admitRun(5, false, 3)).toBe(false);
  });

  it('always admits a run that replaces an existing key, even at the cap', () => {
    expect(admitRun(3, true, 3)).toBe(true);
    expect(admitRun(99, true, 3)).toBe(true);
  });
});

describe('startRun — latch awaitingAnswer (AskUserQuestion)', () => {
  const ws = {} as WebSocket;
  beforeEach(() => { threads.clear(); awaitingAnswer.clear(); vi.mocked(run).mockClear(); });

  it('estaciona um send AUTO enquanto a sessão aguarda resposta da pergunta', () => {
    awaitingAnswer.add('s1');
    startRun(ws, 's1', 'flush da fila', undefined, 'm1', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true);
    expect(run).not.toHaveBeenCalled();
    expect(threads.has('s1')).toBe(false);
    expect(awaitingAnswer.has('s1')).toBe(true); // latch intacto até a resposta real
  });

  it('send MANUAL limpa o latch, roda e o onClose drena o estacionado', () => {
    awaitingAnswer.add('s2');
    startRun(ws, 's2', 'auto estacionado', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true);
    expect(run).not.toHaveBeenCalled();
    startRun(ws, 's2', 'minha resposta à pergunta');
    expect(awaitingAnswer.has('s2')).toBe(false);
    expect(run).toHaveBeenCalledOnce();
    // Fecha o turno da resposta: o item estacionado vira o próximo turno.
    vi.mocked(run).mock.calls[0][0].onClose?.();
    expect(run).toHaveBeenCalledTimes(2);
    expect(vi.mocked(run).mock.calls[1][0].prompt).toBe('auto estacionado');
  });

  it('send AUTO sem latch roda normalmente', () => {
    startRun(ws, 's3', 'fila normal', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true);
    expect(run).toHaveBeenCalledOnce();
  });
});
