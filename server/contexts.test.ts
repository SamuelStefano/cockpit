import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// memoryDir is the agent's real memory folder: point it at a temp dir.
const dir = mkdtempSync(join(tmpdir(), 'deck-ctx-'));
vi.mock('./config', () => ({ CONFIG: { memoryDir: dir } }));

const { installContext, importSlug, MAX_IMPORT_BYTES } = await import('./contexts');

beforeAll(() => writeFileSync(join(dir, 'feedback_rule.md'), 'agent-owned'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('installContext (the shared-context write path into the memory dir)', () => {
  it('always writes under an imported- prefix, so it can never overwrite an agent memory', async () => {
    const r = await installContext('feedback_rule', 'T', 'corpo');
    expect(r).toEqual({ id: 'imported-feedback_rule' });
    expect(readFileSync(join(dir, 'feedback_rule.md'), 'utf8')).toBe('agent-owned');
  });

  it('flattens traversal attempts into a plain slug inside the dir', async () => {
    expect(importSlug('../../etc/passwd')).toBe('imported-etc-passwd');
    const r = await installContext('../../x', 'T', 'corpo');
    expect(r).toEqual({ id: 'imported-x' });
    expect(readdirSync(dir)).toContain('imported-x.md');
  });

  it('keeps a multi-line title from injecting frontmatter keys', async () => {
    await installContext('t', 'nome\ndescription: hacked\nmetadata:', 'corpo');
    const text = readFileSync(join(dir, 'imported-t.md'), 'utf8');
    expect(text.split('\n').filter((l) => l.startsWith('description:'))).toEqual(['description: importado via compartilhamento']);
  });

  it('refuses empty and oversized bodies', async () => {
    expect(await installContext('a', 'T', '   ')).toEqual({ error: 'conteúdo vazio' });
    expect(await installContext('a', 'T', 'x'.repeat(MAX_IMPORT_BYTES + 1))).toEqual({ error: 'conteúdo grande demais' });
  });
});
