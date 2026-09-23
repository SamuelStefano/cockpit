import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { __resetCanvasRefsCache, cardIdFromRefsCache } from './index';

// The cache backing cardIdFromRefsCache is module-level (warmed once per
// process, same as marathon.ts's set) — reset it so each test hits its own
// fresh COCKPIT_CANVAS_REFS file instead of a stale in-memory Map.
describe('cardIdFromRefsCache', () => {
  beforeEach(() => {
    process.env.COCKPIT_CANVAS_REFS = join(mkdtempSync(join(tmpdir(), 'canvas-refs-')), 'refs.json');
    __resetCanvasRefsCache();
  });

  it('reads cardId straight from the persisted refs cache, no transcript scan', async () => {
    writeFileSync(process.env.COCKPIT_CANVAS_REFS!, JSON.stringify({
      'sess-1': { contexts: {}, cardId: 'card-1', consumed: 100, size: 100 },
    }));
    await expect(cardIdFromRefsCache('sess-1')).resolves.toBe('card-1');
  });

  it('returns undefined for an unknown session or a missing cache file', async () => {
    await expect(cardIdFromRefsCache('nope')).resolves.toBeUndefined();
  });
});
