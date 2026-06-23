import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getNotes, saveNotes } from './notes';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'deck-notes-')); process.env.COCKPIT_NOTES = join(dir, 'notes.md'); });
afterEach(() => { delete process.env.COCKPIT_NOTES; try { rmSync(dir, { recursive: true, force: true }); } catch { /* ok */ } });

describe('notes', () => {
  it('devolve vazio quando ainda não há arquivo', async () => {
    expect(await getNotes()).toBe('');
  });

  it('salva e relê o rascunho', async () => {
    await saveNotes('# ideia solta\n- comprar leite');
    expect(await getNotes()).toBe('# ideia solta\n- comprar leite');
  });

  it('trunca acima do teto e não quebra com não-string', async () => {
    await saveNotes('x'.repeat(600_000));
    expect((await getNotes()).length).toBe(500_000);
    // @ts-expect-error robustez
    await saveNotes(undefined);
    expect(await getNotes()).toBe('');
  });
});
