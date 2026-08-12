import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resumableId } from './resume';

describe('resumableId', () => {
  let dir = '';
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'resume-'));
    writeFileSync(join(dir, 'sess-viva.jsonl'), '{}\n');
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('aceita o id cujo transcript existe', () => {
    expect(resumableId('sess-viva', dir)).toBe('sess-viva');
  });

  it('descarta o id sem transcript no disco', () => {
    expect(resumableId('sess-apagada', dir)).toBeUndefined();
  });

  it('descarta id vazio', () => {
    expect(resumableId(undefined, dir)).toBeUndefined();
  });

  // O id vem do parked.json, que é arquivo editável: sem a checagem de formato ele
  // viraria caminho no join.
  it('descarta id com travessia de caminho', () => {
    expect(resumableId('../../etc/passwd', dir)).toBeUndefined();
  });
});
