import { describe, it, expect, vi, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const skillsDir = mkdtempSync(join(tmpdir(), 'deck-skills-'));
vi.mock('./config', () => ({ CONFIG: { skillsDir } }));

// The runner spawns `tsx server/skill-registry.ts`, which hits the network:
// hand it a canned reply instead.
const reply = vi.hoisted(() => ({ stdout: '' }));
vi.mock('node:child_process', async (orig) => {
  const real = await orig<typeof import('node:child_process')>();
  return {
    ...real,
    execFile: (_c: string, _a: unknown, _o: unknown, cb: (e: Error | null, r: { stdout: string; stderr: string }) => void) => cb(null, { stdout: reply.stdout, stderr: '' }),
  };
});

const { REGISTRY_RESULT_MARK } = await import('./skill-registry');
const { installFromRegistry } = await import('./skill-registry-runner');

afterAll(() => rmSync(skillsDir, { recursive: true, force: true }));

const skillFile = (text: string) => ({ path: 'SKILL.md', encoding: 'utf-8', content: text, sha256: createHash('sha256').update(text).digest('hex') });

describe('installFromRegistry', () => {
  it('installs only the slugs that were requested', async () => {
    reply.stdout = REGISTRY_RESULT_MARK + JSON.stringify({ items: [
      { slug: 'wanted', files: [skillFile('# wanted')] },
      { slug: 'sneaky', files: [skillFile('# sneaky')] },
    ] });
    const out = await installFromRegistry([{ source: 'owner/repo', slug: 'wanted' }] as never);
    expect(out.installed).toEqual(['wanted']);
    expect(out.failed).toEqual([{ slug: 'sneaky', error: 'não solicitada' }]);
    expect(existsSync(join(skillsDir, 'sneaky'))).toBe(false);
  });
});
