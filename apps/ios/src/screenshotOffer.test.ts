import { describe, expect, it } from 'vitest';
import { accessStatus, decideOffer, firstRunState, fitWithin, OFFER_WINDOW_MS, parseState, recordOffer, serializeState, toMs, type AssetLike } from './screenshotOffer';

const NOW = 1_800_000_000_000;
const state = { since: NOW - 3_600_000, lastId: null as string | null, lastTime: 0 };
const shot = (over: Partial<AssetLike> = {}): AssetLike => ({ id: 'A/L0/001', mediaType: 'photo', mediaSubtypes: ['screenshot'], creationTime: NOW - 60_000, ...over });
const reason = (a: AssetLike | null, s = state) => {
  const d = decideOffer(a, s, NOW);
  return d.offer ? 'offer' : d.reason;
};

describe('decideOffer', () => {
  it('offers a fresh screenshot', () => expect(reason(shot())).toBe('offer'));
  it('refuses non-screenshots and non-photos', () => {
    expect(reason(shot({ mediaSubtypes: ['hdr'] }))).toBe('not-screenshot');
    expect(reason(shot({ mediaSubtypes: undefined }))).toBe('not-screenshot');
    expect(reason(shot({ mediaType: 'video' }))).toBe('not-photo');
    expect(reason(null)).toBe('not-photo');
  });
  it('uses a 10 minute window', () => {
    expect(reason(shot({ creationTime: NOW - OFFER_WINDOW_MS }))).toBe('offer');
    expect(reason(shot({ creationTime: NOW - OFFER_WINDOW_MS - 1 }))).toBe('too-old');
  });
  it('refuses a future or invalid time', () => {
    expect(reason(shot({ creationTime: NOW + 5 * 60_000 }))).toBe('bad-time');
    expect(reason(shot({ creationTime: NaN }))).toBe('bad-time');
    expect(reason(shot({ creationTime: 0 }))).toBe('bad-time');
  });
  it('allows a little clock skew', () => expect(reason(shot({ creationTime: NOW + 30_000 }))).toBe('offer'));
  it('never offers the same id or anything not newer than the last offer', () => {
    expect(reason(shot(), { ...state, lastId: 'A/L0/001' })).toBe('already-offered');
    expect(reason(shot(), { ...state, lastId: 'other', lastTime: NOW - 30_000 })).toBe('already-offered');
    expect(reason(shot(), { ...state, lastId: 'other', lastTime: NOW - 90_000 })).toBe('offer');
  });
  it('offers nothing taken before the first run', () => {
    expect(reason(shot(), { since: NOW - 30_000, lastId: null, lastTime: 0 })).toBe('before-install');
    expect(reason(shot(), firstRunState(NOW))).toBe('before-install');
  });
  it('reads seconds as seconds', () => {
    expect(toMs(1_800_000_000)).toBe(1_800_000_000_000);
    expect(reason(shot({ creationTime: (NOW - 60_000) / 1000 }))).toBe('offer');
  });
});

describe('state', () => {
  it('records the offer and round-trips', () => {
    const s = recordOffer(state, shot());
    expect(s).toEqual({ ...state, lastId: 'A/L0/001', lastTime: NOW - 60_000 });
    expect(parseState(serializeState(s))).toEqual(s);
  });
  it('never moves lastTime backwards', () => {
    expect(recordOffer({ ...state, lastTime: NOW }, shot()).lastTime).toBe(NOW);
  });
  it('rejects bad persisted values', () => {
    for (const raw of [null, undefined, '', '{', 'null', '[]', '{"since":"1","lastId":null,"lastTime":0}', '{"since":1,"lastId":5,"lastTime":0}', '{"since":1,"lastId":null,"lastTime":-1}', '{"since":0,"lastId":null,"lastTime":0}', 'x'.repeat(2000)]) {
      expect(parseState(raw as string)).toBeNull();
    }
    expect(parseState('{"since":5,"lastId":null,"lastTime":0}')).toEqual({ since: 5, lastId: null, lastTime: 0 });
  });
});

describe('accessStatus', () => {
  it('maps permission responses', () => {
    expect(accessStatus({ granted: true, accessPrivileges: 'limited' })).toBe('limited');
    expect(accessStatus({ granted: true, accessPrivileges: 'all' })).toBe('granted');
    expect(accessStatus({ granted: true })).toBe('granted');
    expect(accessStatus({ granted: false, status: 'undetermined', accessPrivileges: 'none' })).toBe('undetermined');
    expect(accessStatus({ granted: false, status: 'denied', accessPrivileges: 'none' })).toBe('denied');
  });
});

describe('fitWithin', () => {
  it('fits the long side and never upscales', () => {
    expect(fitWithin(1170, 2532, 1600)).toEqual({ height: 1600 });
    expect(fitWithin(2532, 1170, 1600)).toEqual({ width: 1600 });
    expect(fitWithin(800, 1200, 1600)).toBeNull();
    expect(fitWithin(undefined, undefined, 1600)).toEqual({ width: 1600 });
  });
});
