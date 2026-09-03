import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendSample, readSamples, availability, prune } from './history';
import type { Sample } from './probe';

let dir = '';
let file = '';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'deck-monitor-'));
  file = join(dir, 'nested', 'history.jsonl');
});

const s = (ts: number, health: Sample['health'], latencyMs: number | null = 10): Sample =>
  ({ ts, health, latencyMs, detail: '' });

describe('persistência', () => {
  it('cria o diretório e sobrevive ao restart', () => {
    appendSample(file, s(1, 'up'));
    appendSample(file, s(2, 'down', null));
    expect(readSamples(file)).toHaveLength(2);
  });

  it('arquivo inexistente devolve vazio em vez de estourar', () => {
    expect(readSamples(join(dir, 'nao-existe.jsonl'))).toEqual([]);
  });

  it('descarta linha truncada sem perder o resto', () => {
    appendSample(file, s(1, 'up'));
    writeFileSync(file, `${readFileSync(file, 'utf8')}{"ts":2,"heal`);
    expect(readSamples(file)).toHaveLength(1);
  });

  it('filtra por janela', () => {
    for (const ts of [10, 20, 30]) appendSample(file, s(ts, 'up'));
    expect(readSamples(file, 20).map((x) => x.ts)).toEqual([20, 30]);
  });
});

describe('availability', () => {
  it('separa relay de pé da cadeia inteira de pé', () => {
    const a = availability([s(1, 'up'), s(2, 'up'), s(3, 'degraded'), s(4, 'down')]);
    expect(a.relayPct).toBe(75);   // up + degraded
    expect(a.fullPct).toBe(50);    // só up
  });

  it('sem amostra não divide por zero', () => {
    expect(availability([])).toMatchObject({ total: 0, relayPct: 0, fullPct: 0, p50LatencyMs: null });
  });

  it('ignora latência ausente na mediana', () => {
    expect(availability([s(1, 'up', 10), s(2, 'down', null), s(3, 'up', 30)]).p50LatencyMs).toBe(30);
  });
});

describe('prune', () => {
  it('remove o que passou da janela e mantém o arquivo legível', () => {
    for (const ts of [1, 2, 3, 4]) appendSample(file, s(ts, 'up'));
    expect(prune(file, 3)).toBe(2);
    expect(readSamples(file).map((x) => x.ts)).toEqual([3, 4]);
  });

  it('podar tudo deixa arquivo vazio, não arquivo quebrado', () => {
    appendSample(file, s(1, 'up'));
    prune(file, 99);
    expect(readSamples(file)).toEqual([]);
  });
});
