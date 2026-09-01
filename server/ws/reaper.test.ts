import { describe, it, expect, vi } from 'vitest';
import { findStaleThreads, REAPER_SILENCE_CAP_MS, REAPER_TOOL_SILENCE_CAP_MS, REAPER_TOTAL_CAP_MS } from './reaper';

vi.mock('./broadcast', () => ({ broadcast: vi.fn(), send: vi.fn(), setWss: vi.fn() }));
vi.mock('./incidents', () => ({ recordIncident: vi.fn() }));

describe('findStaleThreads', () => {
  const now = 1_000_000_000;
  type Entry = [string, { startedAt: number; lastFrameAt?: number; openToolsAt?: number[] }];
  const keys = (e: Entry[]) => findStaleThreads(now, e).map((v) => v.key);

  it('mata turno mudo além do teto de silêncio', () => {
    const entries: Entry[] = [['a', { startedAt: now - 60_000, lastFrameAt: now - REAPER_SILENCE_CAP_MS - 1 }]];
    expect(findStaleThreads(now, entries)).toEqual([{ key: 'a', reason: 'silence', ms: REAPER_SILENCE_CAP_MS + 1 }]);
  });

  it('preserva turno com frame recente', () => {
    const entries: Entry[] = [['a', { startedAt: now - REAPER_SILENCE_CAP_MS - 1, lastFrameAt: now - 1000 }]];
    expect(keys(entries)).toEqual([]);
  });

  // A regressão que o Samuel sentiu como "o turno só roda com a janela aberta": o
  // teto absoluto de 45min matava turno em pleno progresso.
  it('preserva turno longo que segue emitindo frames', () => {
    const entries: Entry[] = [['a', { startedAt: now - 3 * 60 * 60_000, lastFrameAt: now - 1000 }]];
    expect(keys(entries)).toEqual([]);
  });

  it('poupa silêncio longo enquanto uma tool está em voo', () => {
    const silent = now - REAPER_SILENCE_CAP_MS - 1;
    expect(keys([['a', { startedAt: now - 60_000, lastFrameAt: silent, openToolsAt: [now - 60_000] }]])).toEqual([]);
  });

  it('mata tool travada além do teto de tool', () => {
    const entries: Entry[] = [['a', { startedAt: now - 60_000, lastFrameAt: now - REAPER_TOOL_SILENCE_CAP_MS - 1, openToolsAt: [now - 1000, now - 2000] }]];
    expect(findStaleThreads(now, entries)[0]).toMatchObject({ key: 'a', reason: 'tool' });
  });

  // toolStart é grudento: um tool_use sem tool_result deixa a chave lá pro resto do
  // turno. Se "em voo" fosse só contagem, esse fantasma rebaixaria o teto de 15 pra
  // 90min pra sempre — o turno travado sobreviveria 6x mais que devia.
  it('ignora tool aberta há mais que o próprio teto de tool', () => {
    const entries: Entry[] = [['a', { startedAt: now - 3 * 60 * 60_000, lastFrameAt: now - REAPER_SILENCE_CAP_MS - 1, openToolsAt: [now - REAPER_TOOL_SILENCE_CAP_MS - 1] }]];
    expect(findStaleThreads(now, entries)[0]).toMatchObject({ key: 'a', reason: 'silence' });
  });

  it('mata turno além do teto total mesmo com frames chegando', () => {
    const entries: Entry[] = [['a', { startedAt: now - REAPER_TOTAL_CAP_MS - 1, lastFrameAt: now - 500 }]];
    expect(findStaleThreads(now, entries)[0]).toMatchObject({ key: 'a', reason: 'total' });
  });

  it('turno sem frame algum conta silêncio desde o início', () => {
    const entries: Entry[] = [
      ['fresh', { startedAt: now - 1000 }],
      ['old', { startedAt: now - REAPER_SILENCE_CAP_MS - 1 }],
    ];
    expect(keys(entries)).toEqual(['old']);
  });

  it('respeita tetos injetados', () => {
    const entries: Entry[] = [['a', { startedAt: now - 5000, lastFrameAt: now - 4000 }]];
    expect(keys(entries)).toEqual([]);
    expect(findStaleThreads(now, entries, { silence: 3000 }).map((v) => v.key)).toEqual(['a']);
  });
});

// A maratona é a lane do prompt de 21h: o teto de VIDA de 8h a mataria em plena
// produção, mas os tetos de silêncio têm que continuar valendo — na maratona
// ninguém está olhando pra perceber que travou.
describe('tetos da maratona', () => {
  const T = 60_000;

  it('turno comum morre no teto de vida; maratona não', () => {
    const velho = { startedAt: 0, lastFrameAt: 9 * 60 * 60_000 };
    const now = 9 * 60 * 60_000;
    expect(findStaleThreads(now, [['a', velho]])).toEqual([{ key: 'a', reason: 'total', ms: now }]);
    expect(findStaleThreads(now, [['a', { ...velho, marathon: true }]])).toEqual([]);
  });

  it('maratona muda ainda é reapada por silêncio', () => {
    const now = 9 * 60 * 60_000;
    const mudo = { startedAt: 0, lastFrameAt: now - 20 * T, marathon: true };
    expect(findStaleThreads(now, [['a', mudo]])[0]).toMatchObject({ reason: 'silence' });
  });

  it('maratona também tem um fim: 72h', () => {
    const now = 73 * 60 * 60_000;
    const vivo = { startedAt: 0, lastFrameAt: now - 1, marathon: true };
    expect(findStaleThreads(now, [['a', vivo]])[0]).toMatchObject({ reason: 'total' });
  });
});
