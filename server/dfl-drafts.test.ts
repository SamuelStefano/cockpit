import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readDrafts, mutateDrafts, draftsFile } from './dfl-drafts';
import { MAX_NOTE_BYTES } from './pontos-agent';
import { DRAFT_NOTE_MAX_BYTES } from '../shared/dfl-drafts-note';

describe('dfl-drafts store', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'drafts-')); process.env.COCKPIT_DFL_DRAFTS = join(dir, 'dfl-drafts.json'); });
  afterEach(async () => { delete process.env.COCKPIT_DFL_DRAFTS; await rm(dir, { recursive: true, force: true }); });

  it('missing or corrupted file reads as empty', async () => {
    expect(await readDrafts()).toEqual([]);
    await writeFile(draftsFile(), '{ nope', 'utf8');
    expect(await readDrafts()).toEqual([]);
  });

  it('persists mutations and reads them back', async () => {
    const [ep] = await mutateDrafts({ op: 'add-epic', title: 'Épico', tasks: [{ title: 'T', points: 2, refs: ['LS#1'] }] });
    expect(ep.id).toMatch(/^ep-[0-9a-f]{6}$/);
    await mutateDrafts({ op: 'set-status', id: ep.id, status: 'dispatched' });
    const [back] = await readDrafts();
    expect(back).toMatchObject({ title: 'Épico', status: 'dispatched' });
    expect(back.tasks[0]).toMatchObject({ title: 'T', points: 2, refs: ['LS#1'] });
    expect(JSON.parse(await readFile(draftsFile(), 'utf8'))).toHaveLength(1);
  });

  it('serialises concurrent writes so none is lost', async () => {
    await Promise.all(['a', 'b', 'c'].map((t) => mutateDrafts({ op: 'add-epic', title: t })));
    expect((await readDrafts()).map((d) => d.title).sort()).toEqual(['a', 'b', 'c']);
  });

  it('a failed op rejects without writing and does not block the next one', async () => {
    await expect(mutateDrafts({ op: 'delete-task', epicId: 'nope', taskId: 'x' })).rejects.toThrow(/não existe/);
    await mutateDrafts({ op: 'add-epic', title: 'depois' });
    expect(await readDrafts()).toHaveLength(1);
  });

  it('the client batch limit fits the server note limit', () => {
    expect(DRAFT_NOTE_MAX_BYTES).toBeLessThanOrEqual(MAX_NOTE_BYTES);
  });
});
