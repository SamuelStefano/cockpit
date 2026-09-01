import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// COCKPIT_AWAITING é lido no import (const AWAITING_PATH), então fixamos o caminho
// ANTES de importar. Cada caso apaga o arquivo: as ops releem o disco a cada chamada.
const DIR = mkdtempSync(join(tmpdir(), 'awaiting-'));
const FILE = join(DIR, 'awaiting.json');
process.env.COCKPIT_AWAITING = FILE;

const { isAwaiting, setAwaiting, clearAwaiting, clearAllAwaiting } = await import('./awaiting');

beforeEach(() => rmSync(FILE, { force: true }));
afterAll(() => rmSync(DIR, { recursive: true, force: true }));

describe('latch de AskUserQuestion', () => {
  it('nasce vazio quando o arquivo não existe', () => {
    expect(isAwaiting('s1')).toBe(false);
  });

  it('faz roundtrip set → is → clear', () => {
    setAwaiting('s1');
    expect(isAwaiting('s1')).toBe(true);
    clearAwaiting('s1');
    expect(isAwaiting('s1')).toBe(false);
  });

  it('isola sessões diferentes', () => {
    setAwaiting('s1');
    setAwaiting('s2');
    clearAwaiting('s1');
    expect(isAwaiting('s1')).toBe(false);
    expect(isAwaiting('s2')).toBe(true);
  });

  it('set duplicado não duplica a chave em disco', () => {
    setAwaiting('s1');
    setAwaiting('s1');
    expect(JSON.parse(readFileSync(FILE, 'utf8'))).toEqual(['s1']);
  });

  it('clear de chave ausente não cria arquivo', () => {
    clearAwaiting('fantasma');
    expect(readdirSync(DIR)).toEqual([]);
  });

  it('clearAllAwaiting zera todas as sessões', () => {
    setAwaiting('s1');
    setAwaiting('s2');
    clearAllAwaiting();
    expect(isAwaiting('s1')).toBe(false);
    expect(isAwaiting('s2')).toBe(false);
  });
});

describe('latch: leitura tolerante e cross-process', () => {
  // O latch é fonte de verdade COMPARTILHADA (handlers no index por loopback, drainer
  // no agente). Reler o disco a cada chamada é o contrato: um cache aqui ficaria stale
  // com a escrita do outro processo e reabriria a janela do atropelo de fila.
  it('enxerga o que outro processo escreveu, sem cache', () => {
    setAwaiting('s1');
    writeFileSync(FILE, JSON.stringify(['s1', 'outro-processo']), 'utf8');
    expect(isAwaiting('outro-processo')).toBe(true);
  });

  it('trata JSON corrompido como latch vazio em vez de estourar', () => {
    writeFileSync(FILE, '{ nao é json', 'utf8');
    expect(isAwaiting('s1')).toBe(false);
    setAwaiting('s1');
    expect(isAwaiting('s1')).toBe(true);
  });

  it('descarta entradas não-string e formato que não é array', () => {
    writeFileSync(FILE, JSON.stringify(['ok', 42, null, { a: 1 }]), 'utf8');
    expect(isAwaiting('ok')).toBe(true);
    setAwaiting('novo');
    expect(JSON.parse(readFileSync(FILE, 'utf8'))).toEqual(['ok', 'novo']);

    writeFileSync(FILE, JSON.stringify({ s1: true }), 'utf8');
    expect(isAwaiting('s1')).toBe(false);
  });

  it('não deixa .tmp para trás: a troca é rename atômico', () => {
    setAwaiting('s1');
    expect(readdirSync(DIR)).toEqual(['awaiting.json']);
  });
});
