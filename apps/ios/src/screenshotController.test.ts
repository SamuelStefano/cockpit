import { describe, expect, it, vi } from 'vitest';
import { createScreenshotController, type ScreenshotDeps } from './screenshotController';
import type { AccessStatus, AssetLike, OfferState } from './screenshotOffer';
import type { ShellEvent } from './shellEvents';

const NOW = 1_800_000_000_000;
const shot = (over: Partial<AssetLike> = {}): AssetLike => ({ id: 'A/L0/001', mediaType: 'photo', mediaSubtypes: ['screenshot'], creationTime: NOW - 60_000, ...over });

function setup(opts: { access?: AccessStatus; afterPrompt?: AccessStatus; saved?: OfferState | null; asset?: AssetLike | null } = {}) {
  const sent: ShellEvent[] = [];
  let saved: OfferState | null = opts.saved === undefined ? { since: NOW - 3_600_000, lastId: null, lastTime: 0 } : opts.saved;
  let access: AccessStatus = opts.access ?? 'granted';
  const deps = {
    now: () => NOW,
    getAccess: vi.fn(async () => access),
    requestAccess: vi.fn(async () => { access = opts.afterPrompt ?? 'granted'; return access; }),
    latestScreenshot: vi.fn(async () => (opts.asset === undefined ? shot() : opts.asset)),
    makeThumbnail: vi.fn(async () => 'data:image/jpeg;base64,THUMB'),
    makeFullImage: vi.fn(async () => 'data:image/jpeg;base64,FULL'),
    loadState: vi.fn(async () => saved),
    saveState: vi.fn(async (s: OfferState) => { saved = s; }),
    send: (e: ShellEvent) => { sent.push(e); },
  } satisfies ScreenshotDeps;
  return { c: createScreenshotController(deps), deps, sent, saved: () => saved };
}

describe('screenshot controller', () => {
  it('touches nothing before enable', async () => {
    const { c, deps, sent } = setup();
    await c.check();
    await c.accept('A/L0/001');
    expect(deps.getAccess).not.toHaveBeenCalled();
    expect(deps.latestScreenshot).not.toHaveBeenCalled();
    expect(deps.loadState).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it('enable asks for access only when undetermined, reports it, and offers a fresh print', async () => {
    const { c, deps, sent } = setup({ access: 'undetermined', afterPrompt: 'granted' });
    await c.enable();
    expect(deps.requestAccess).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([
      { type: 'screenshots-status', status: 'granted' },
      { type: 'screenshot-available', id: 'A/L0/001', thumbnail: 'data:image/jpeg;base64,THUMB' },
    ]);
  });

  it('does not prompt again when access is already decided', async () => {
    const { c, deps } = setup({ access: 'granted' });
    await c.enable();
    expect(deps.requestAccess).not.toHaveBeenCalled();
  });

  it('denied: reports it, never reads the library, never prompts again', async () => {
    const { c, deps, sent } = setup({ access: 'denied' });
    await c.enable();
    await c.check();
    expect(deps.requestAccess).not.toHaveBeenCalled();
    expect(deps.latestScreenshot).not.toHaveBeenCalled();
    expect(sent.every((e) => e.type === 'screenshots-status' && e.status === 'denied')).toBe(true);
  });

  it('denied at the system prompt: reports denied, offers nothing', async () => {
    const { c, deps, sent } = setup({ access: 'undetermined', afterPrompt: 'denied' });
    await c.enable();
    expect(sent).toEqual([{ type: 'screenshots-status', status: 'denied' }]);
    expect(deps.latestScreenshot).not.toHaveBeenCalled();
  });

  it('limited: reports limited and still looks', async () => {
    const { c, sent } = setup({ access: 'limited' });
    await c.enable();
    expect(sent[0]).toEqual({ type: 'screenshots-status', status: 'limited' });
    expect(sent[1]?.type).toBe('screenshot-available');
  });

  it('records the offer before sending, and never offers the same print twice', async () => {
    const { c, sent, saved } = setup();
    await c.enable();
    expect(saved()?.lastId).toBe('A/L0/001');
    await c.check();
    await c.check();
    expect(sent.filter((e) => e.type === 'screenshot-available')).toHaveLength(1);
  });

  it('first run records the install time and offers nothing older', async () => {
    const { c, sent, saved } = setup({ saved: null });
    await c.enable();
    expect(saved()?.since).toBe(NOW);
    expect(sent.filter((e) => e.type === 'screenshot-available')).toEqual([]);
  });

  it('offers nothing for a non-screenshot or an old one', async () => {
    for (const asset of [shot({ mediaSubtypes: [] }), shot({ creationTime: NOW - 11 * 60_000 }), null]) {
      const { c, sent } = setup({ asset });
      await c.enable();
      expect(sent.filter((e) => e.type === 'screenshot-available')).toEqual([]);
    }
  });

  it('sends the full image only after accept of the offered id', async () => {
    const { c, deps, sent } = setup();
    await c.enable();
    expect(deps.makeFullImage).not.toHaveBeenCalled();
    await c.accept('SOMETHING-ELSE');
    expect(deps.makeFullImage).not.toHaveBeenCalled();
    await c.accept('A/L0/001');
    expect(sent.at(-1)).toEqual({ type: 'screenshot-data', id: 'A/L0/001', dataUrl: 'data:image/jpeg;base64,FULL' });
    await c.accept('A/L0/001');
    expect(deps.makeFullImage).toHaveBeenCalledTimes(1);
  });

  it('disable stops offers and invalidates a pending accept', async () => {
    const { c, deps, sent } = setup();
    await c.enable();
    c.disable();
    await c.accept('A/L0/001');
    await c.check();
    expect(deps.makeFullImage).not.toHaveBeenCalled();
    expect(sent.filter((e) => e.type === 'screenshot-data')).toEqual([]);
  });

  it('swallows a failing library call', async () => {
    const { c, deps, sent } = setup();
    deps.latestScreenshot.mockRejectedValueOnce(new Error('iCloud'));
    await expect(c.enable()).resolves.toBeUndefined();
    expect(sent.filter((e) => e.type === 'screenshot-available')).toEqual([]);
  });
});
