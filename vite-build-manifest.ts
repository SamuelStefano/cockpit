import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { parseBuild } from './server/build-id';

export function writeBuildManifest(distDir: string): void {
  const file = join(distDir, 'index.html');
  const manifest = parseBuild(readFileSync(file, 'utf8'), statSync(file).mtimeMs);
  writeFileSync(join(distDir, 'build.json'), JSON.stringify(manifest));
}

// Vercel has no server, so /api/build falls into the SPA rewrite and answers HTML.
// A static file gives every host the same update signal.
export function buildManifestPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'deck-build-manifest',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir; },
    closeBundle: { order: 'post', handler() { writeBuildManifest(outDir); } },
  };
}
