import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Everything the primitives index re-exports lands in the entry's static graph.
// The live-preview studio pulls the sucrase compiler; exporting it here made
// every page load preload ~56 KB gzip nobody asked for. Import it from
// ./lazyPreviews instead.
describe('primitives index', () => {
  it('does not statically re-export the live-preview studio', () => {
    const src = readFileSync(join(__dirname, 'index.tsx'), 'utf8');
    expect(src).not.toMatch(/livepreview\//);
  });
});
