import { describe, expect, it } from 'vitest';
import { chromeReducer, initialChrome, MAX_DEATHS, webViewHandlesBack, type ChromeEvent, type ChromeState } from './chromeState';

const run = (events: ChromeEvent[], from: ChromeState = initialChrome) => events.reduce(chromeReducer, from);

describe('chromeReducer', () => {
  it('goes loading -> ready', () => {
    expect(run([{ type: 'loadStart' }, { type: 'loadEnd' }]).phase).toBe('ready');
  });
  it('fails on error and keeps the card on a new loadStart', () => {
    const s = run([{ type: 'error' }, { type: 'loadStart' }, { type: 'loadEnd' }]);
    expect(s.phase).toBe('failed');
    expect(s.reason).toBe('error');
  });
  it('counts a main-frame HTTP error only', () => {
    expect(run([{ type: 'httpError', status: 503, mainFrame: false }]).phase).toBe('loading');
    expect(run([{ type: 'httpError', status: 200, mainFrame: true }]).phase).toBe('loading');
    expect(run([{ type: 'httpError', status: 503, mainFrame: true }]).reason).toBe('http');
  });
  it('recovers from a timeout when the load ends', () => {
    expect(run([{ type: 'timeout' }, { type: 'loadEnd' }]).phase).toBe('ready');
  });
  it('ignores a timeout once ready', () => {
    expect(run([{ type: 'loadEnd' }, { type: 'timeout' }]).phase).toBe('ready');
  });
  it('retry remounts (attempt + 1) and resets', () => {
    const s = run([{ type: 'error' }, { type: 'retry' }]);
    expect(s).toEqual({ phase: 'loading', attempt: 1, deaths: 0 });
  });
  it('remounts on process death and shows the card after three in a row', () => {
    expect(run([{ type: 'processGone' }])).toMatchObject({ phase: 'loading', attempt: 1, deaths: 1 });
    const s = run(Array.from({ length: MAX_DEATHS }, () => ({ type: 'processGone' }) as ChromeEvent));
    expect(s).toMatchObject({ phase: 'failed', reason: 'process' });
  });
  it('a successful load resets the death count', () => {
    expect(run([{ type: 'processGone' }, { type: 'loadEnd' }]).deaths).toBe(0);
  });
});

describe('webViewHandlesBack', () => {
  it('is false while failed or when the WebView cannot go back', () => {
    expect(webViewHandlesBack({ ...initialChrome, phase: 'ready' }, true)).toBe(true);
    expect(webViewHandlesBack({ ...initialChrome, phase: 'failed' }, true)).toBe(false);
    expect(webViewHandlesBack({ ...initialChrome, phase: 'ready' }, false)).toBe(false);
  });
});
