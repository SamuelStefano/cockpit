import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// COCKPIT_INCIDENTS é lido no import; fixamos antes e limpamos entre os casos.
const DIR = mkdtempSync(join(tmpdir(), 'incidents-'));
const FILE = join(DIR, 'incidents.jsonl');
process.env.COCKPIT_INCIDENTS = FILE;

const { recordIncident } = await import('./incidents');

const lines = () => readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

beforeEach(() => rmSync(FILE, { force: true }));
afterAll(() => rmSync(DIR, { recursive: true, force: true }));

describe('trilha de incidentes', () => {
  it('grava JSONL com ts ISO e os campos do incidente', () => {
    recordIncident({ kind: 'run-error', sessionKey: 's1', sessionId: 'abc', detail: 'exit 1' });
    const [i] = lines();
    expect(i).toMatchObject({ kind: 'run-error', sessionKey: 's1', sessionId: 'abc', detail: 'exit 1' });
    expect(new Date(i.ts).toISOString()).toBe(i.ts);
  });

  it('acumula em append, uma linha por incidente', () => {
    recordIncident({ kind: 'silent-death', sessionKey: 's1' });
    recordIncident({ kind: 'reaped', sessionKey: 's2' });
    expect(lines().map((i) => i.kind)).toEqual(['silent-death', 'reaped']);
  });

  it('omite detail quando não veio', () => {
    recordIncident({ kind: 'orphan-resume', sessionKey: 's1' });
    expect('detail' in lines()[0]).toBe(false);
  });
});

describe('tetos do log (ele vira prompt de um triador de IA)', () => {
  it('trunca um detail gordo em vez de deixá-lo passar inteiro', () => {
    recordIncident({ kind: 'run-error', sessionKey: 's1', detail: 'x'.repeat(50_000) });
    // O teto do ARQUIVO é conferido antes do append, então sem teto por linha um único
    // dump de stderr entraria por completo e só seria podado no incidente SEGUINTE.
    expect(lines()[0].detail.length).toBe(400);
    expect(statSync(FILE).size).toBeLessThan(1000);
  });

  it('rotaciona guardando as últimas linhas quando o arquivo passa do teto', () => {
    const gordo = `${JSON.stringify({ ts: 'x', kind: 'reaped', sessionKey: 'velho' })}\n`;
    writeFileSync(FILE, gordo.repeat(Math.ceil((257 * 1024) / gordo.length)), 'utf8');
    expect(statSync(FILE).size).toBeGreaterThan(256 * 1024);

    recordIncident({ kind: 'run-error', sessionKey: 'novo' });
    const kept = lines();
    expect(kept).toHaveLength(201);
    expect(kept.at(-1)).toMatchObject({ sessionKey: 'novo' });
  });

  it('não rotaciona um arquivo abaixo do teto', () => {
    recordIncident({ kind: 'reaped', sessionKey: 's1' });
    recordIncident({ kind: 'reaped', sessionKey: 's2' });
    expect(lines()).toHaveLength(2);
  });

  it('engole erro de disco: registrar incidente não pode derrubar o turno', () => {
    // o caminho do log virou diretório — o append falha e mesmo assim nada propaga,
    // porque o cenário real é erro em cima de erro (o turno já está caindo).
    rmSync(FILE, { force: true });
    mkdirSync(FILE);
    expect(() => recordIncident({ kind: 'reaped', sessionKey: 's1' })).not.toThrow();
    rmSync(FILE, { recursive: true, force: true });
  });
});
