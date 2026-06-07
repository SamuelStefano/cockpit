import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Red line #4 (DR-023): the relay must be STRUCTURALLY incapable of spawning. This
// guards the dependency boundary — any import of the engine/terminals/run pipeline
// or a process-spawning primitive fails the build, so the separation can't rot.

const here = dirname(fileURLToPath(import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const FORBIDDEN = [
  /from\s+['"]node:child_process['"]/,
  /from\s+['"]child_process['"]/,
  /from\s+['"]node-pty['"]/,
  /from\s+['"]better-sqlite3['"]/,
  /from\s+['"][^'"]*\/server\//,        // anything reaching into server/
  /from\s+['"][^'"]*\/engine\/claude['"]/,
  /from\s+['"][^'"]*\/terminals['"]/,
  /from\s+['"][^'"]*\/ws\/runs['"]/,
  /from\s+['"][^'"]*\/ws\/dispatch['"]/,
];

describe('relay dependency boundary', () => {
  const files = walk(join(here, 'src')).filter((f) => !f.endsWith('.test.ts'));

  it('has source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const f of files) {
    it(`${f.slice(here.length + 1)} imports nothing that can spawn`, () => {
      const src = readFileSync(f, 'utf8');
      for (const re of FORBIDDEN) {
        expect(re.test(src), `forbidden import matching ${re} in ${f}`).toBe(false);
      }
    });
  }
});
