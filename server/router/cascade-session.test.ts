import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'deck-cascade-session-'));
process.env.COCKPIT_CASCADE_SESSIONS = join(dir, 'cascade-sessions.json');

const C = await import('./cascade-session');

afterAll(() => rmSync(dir, { recursive: true, force: true }));

beforeEach(() => {
  for (const k of C.cascadeSessionKeys()) C.setCascadeSession(k, false);
  C.__resetCascadeSessionCache();
});

describe('cascata por sessão', () => {
  it('marca, consulta e desmarca', () => {
    expect(C.isCascadeSession('s1')).toBe(false);
    C.setCascadeSession('s1', true);
    expect(C.isCascadeSession('s1')).toBe(true);
    C.setCascadeSession('s1', false);
    expect(C.isCascadeSession('s1')).toBe(false);
  });

  it('não afeta outras sessões', () => {
    C.setCascadeSession('s1', true);
    expect(C.isCascadeSession('s2')).toBe(false);
  });

  it('sobrevive ao restart do agente, mas só pra esta sessão', () => {
    C.setCascadeSession('s2', true);
    C.__resetCascadeSessionCache();
    expect(C.isCascadeSession('s2')).toBe(true);
    expect(JSON.parse(readFileSync(process.env.COCKPIT_CASCADE_SESSIONS!, 'utf8')).keys).toContain('s2');
  });

  it('acha a marca por qualquer uma das duas chaves da sessão', () => {
    C.setCascadeSession('uuid-real', true);
    expect(C.threadWantsCascade('new-abc', 'uuid-real')).toBe(true);
    C.setCascadeSession('uuid-real', false);
    C.setCascadeSession('new-abc', true);
    expect(C.threadWantsCascade('new-abc', 'uuid-real')).toBe(true);
    expect(C.threadWantsCascade('outra', 'tambem-outra')).toBe(false);
  });

  it('arquivo corrompido não derruba o servidor', () => {
    C.setCascadeSession('s3', true);
    writeFileSync(process.env.COCKPIT_CASCADE_SESSIONS!, 'não é json');
    C.__resetCascadeSessionCache();
    expect(C.isCascadeSession('s3')).toBe(false);
  });
});
