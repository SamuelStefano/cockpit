import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = mkdtempSync(join(tmpdir(), 'deck-mem-'));
const memDir = join(root, 'memory');
vi.mock('./config', () => ({ CONFIG: { memoryDir: join(root, 'memory') } }));

const { getMemories, saveMemory, deleteMemory, validateMemoryInput, readMemoriesSafe } = await import('./memories');

const OLD_MD = `---\nname: Regra antiga\ndescription: formato antigo\nmetadata:\n  type: feedback\n---\n\nNunca prometa nota.\n`;

beforeEach(() => {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(memDir, { recursive: true });
  process.env.COCKPIT_MEMORIES = join(root, 'memories.json');
});
afterEach(() => { delete process.env.COCKPIT_MEMORIES; });

describe('migration from the old /contextos files', () => {
  it('imports every .md as a memory without touching the file', async () => {
    writeFileSync(join(memDir, 'feedback_rule.md'), OLD_MD);
    writeFileSync(join(memDir, 'MEMORY.md'), 'index');
    const items = await getMemories();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'ctx-feedback_rule', title: 'Regra antiga', body: expect.stringContaining('Nunca prometa nota.'), agents: [], fromDisk: true });
    expect(readFileSync(join(memDir, 'feedback_rule.md'), 'utf8')).toBe(OLD_MD);
  });

  it('keeps the readers the user chose when the agent rewrites the file', async () => {
    const f = join(memDir, 'a.md');
    writeFileSync(f, OLD_MD);
    await getMemories();
    await saveMemory({ id: 'ctx-a', title: 'Regra antiga', body: 'Nunca prometa nota.', agents: ['bot1'] });
    writeFileSync(f, OLD_MD.replace('Nunca prometa nota.', 'Texto novo do agente.'));
    const future = new Date(Date.now() + 60_000);
    utimesSync(f, future, future);
    const [m] = await getMemories();
    expect(m.body).toContain('Texto novo do agente.');
    expect(m.agents).toEqual(['bot1']);
  });

  it('never writes to memoryDir: mem-save only changes readers, mem-delete is a no-op', async () => {
    writeFileSync(join(memDir, 'a.md'), OLD_MD);
    writeFileSync(join(memDir, 'MEMORY.md'), 'index');
    await getMemories();
    const before = readdirSync(memDir).map((f) => [f, readFileSync(join(memDir, f), 'utf8')]);
    const r = await saveMemory({ id: 'ctx-a', title: 'Hack', body: 'Hack', agents: ['bot1'] });
    expect(r.ok && r.items[0]).toMatchObject({ title: 'Regra antiga', agents: ['bot1'], fromDisk: true });
    expect(r.ok && r.items[0].body).toContain('Nunca prometa nota.');
    const after = await deleteMemory('ctx-a');
    expect(after).toHaveLength(1);
    expect(readdirSync(memDir).map((f) => [f, readFileSync(join(memDir, f), 'utf8')])).toEqual(before);
    expect((await getMemories()).some((m) => m.title === 'MEMORY')).toBe(false);
  });

  it('reads a bare-array memories.json from before the versioned format', async () => {
    writeFileSync(process.env.COCKPIT_MEMORIES!, JSON.stringify([{ id: 'x1', title: 'T', body: 'B', agents: ['b'], updatedAt: 1, updatedBy: 'user' }]));
    expect((await getMemories()).map((m) => m.id)).toEqual(['x1']);
  });
});

describe('saveMemory / deleteMemory', () => {
  it('creates, updates and removes an app memory', async () => {
    const r = await saveMemory({ title: 'Marca', body: 'Tom caloroso', agents: ['a', 'b'] });
    expect(r.ok && r.items[0].id).toMatch(/^m-/);
    const id = (r as { items: { id: string }[] }).items[0].id;
    await saveMemory({ id, title: 'Marca', body: 'Tom direto', agents: ['a'] });
    expect((await readMemoriesSafe())[0]).toMatchObject({ body: 'Tom direto', agents: ['a'], updatedBy: 'user' });
    expect(await deleteMemory(id)).toEqual([]);
  });
});

describe('validateMemoryInput', () => {
  it('rejects bad ids, empty titles and huge bodies; cleans agents', () => {
    expect(validateMemoryInput({ id: '../x', title: 't', body: '', agents: [] }).ok).toBe(false);
    expect(validateMemoryInput({ title: '  ', body: '', agents: [] }).ok).toBe(false);
    expect(validateMemoryInput({ title: 't', body: 'x'.repeat(300_000), agents: [] }).ok).toBe(false);
    const v = validateMemoryInput({ title: 'a\nb', body: 'c', agents: ['ok', 'ok', '../no', 5] });
    expect(v.ok && v.input).toMatchObject({ title: 'a b', agents: ['ok'] });
  });
});
