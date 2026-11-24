import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeBuildManifest } from './vite-build-manifest';

describe('writeBuildManifest', () => {
  it('writes the entry the page loads as JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'deck-build-'));
    writeFileSync(join(dir, 'index.html'), '<script type="module" crossorigin src="/assets/index-abc.js"></script>');
    writeBuildManifest(dir);
    expect(JSON.parse(readFileSync(join(dir, 'build.json'), 'utf8')).entry).toBe('/assets/index-abc.js');
  });
});
