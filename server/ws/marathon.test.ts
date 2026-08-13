import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'deck-marathon-'));
process.env.COCKPIT_MARATHON = join(dir, 'marathon.json');

const M = await import('./marathon');

afterAll(() => rmSync(dir, { recursive: true, force: true }));

beforeEach(() => {
  for (const k of M.marathonKeys()) M.setMarathon(k, false);
  M.__resetMarathonCache();
});

describe('marca de maratona', () => {
  it('marca, consulta e desmarca', () => {
    expect(M.isMarathon('s1')).toBe(false);
    M.setMarathon('s1', true);
    expect(M.isMarathon('s1')).toBe(true);
    M.setMarathon('s1', false);
    expect(M.isMarathon('s1')).toBe(false);
  });

  it('sobrevive ao restart do agente (a maratona atravessa deploy)', () => {
    M.setMarathon('s2', true);
    M.__resetMarathonCache();
    expect(M.isMarathon('s2')).toBe(true);
    expect(JSON.parse(readFileSync(process.env.COCKPIT_MARATHON!, 'utf8')).keys).toContain('s2');
  });

  // O servidor keyeia o thread por 'new-xxx' a vida inteira, mas o usuário marca a
  // sessão pelo UUID que a sidebar mostra. Consultar só uma das chaves perderia a
  // marca justamente no turno longo.
  it('acha a marca por qualquer uma das duas chaves da sessão', () => {
    M.setMarathon('uuid-real', true);
    expect(M.threadIsMarathon('new-abc', 'uuid-real')).toBe(true);
    M.setMarathon('uuid-real', false);
    M.setMarathon('new-abc', true);
    expect(M.threadIsMarathon('new-abc', 'uuid-real')).toBe(true);
    expect(M.threadIsMarathon('outra', 'tambem-outra')).toBe(false);
  });

  it('arquivo corrompido não derruba o servidor', () => {
    M.setMarathon('s3', true);
    writeFileSync(process.env.COCKPIT_MARATHON!, 'não é json');
    M.__resetMarathonCache();
    expect(M.isMarathon('s3')).toBe(false);
  });
});
