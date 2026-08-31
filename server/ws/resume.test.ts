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
    writeFileSync(join(dir, 'sess-vazia.jsonl'), '');
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('aceita o id cujo transcript existe', () => {
    expect(resumableId('sess-viva', dir)).toBe('sess-viva');
  });

  it('descarta o id sem transcript no disco', () => {
    expect(resumableId('sess-apagada', dir)).toBeUndefined();
  });

  // Transcript existe mas está zerado (sessão criada, processo morto antes de
  // escrever). Existir não é ter o que retomar: o `--resume` morre igual e o item
  // volta pra fila em loop até bater o teto.
  it('descarta o id cujo transcript está vazio', () => {
    expect(resumableId('sess-vazia', dir)).toBeUndefined();
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
