import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadedEntry, hasUpdate, fetchBuild } from './app-update';

// Stub em vez de jsdom: a box tem 3.7GB e este arquivo é o único do src/ que
// tocaria o DOM. loadedEntry só usa querySelector + getAttribute.
const doc = (src: string | null): Document =>
  ({ querySelector: (sel: string) => (src && sel.includes('/assets/') && src.startsWith('/assets/') ? { getAttribute: () => src } : null) }) as unknown as Document;

describe('loadedEntry', () => {
  it('reads the entry this page is running', () => {
    expect(loadedEntry(doc('/assets/index-abc.js'))).toBe('/assets/index-abc.js');
  });

  // No dev server o index.html aponta pro /src/main.tsx: sem bundle não há versão
  // pra comparar, e um entry inventado faria o aviso aparecer pra sempre.
  it('returns null on the dev index.html', () => {
    expect(loadedEntry(doc('/src/main.tsx'))).toBeNull();
  });
});

describe('hasUpdate', () => {
  const served = (entry: string | null) => ({ entry, sha256: 'x', builtAt: 1 });

  it('flags a deploy that changed the bundle hash', () => {
    expect(hasUpdate('/assets/index-abc.js', served('/assets/index-zzz.js'))).toBe(true);
  });

  it('stays quiet on the same bundle', () => {
    expect(hasUpdate('/assets/index-abc.js', served('/assets/index-abc.js'))).toBe(false);
  });

  it('stays quiet when either side is unknown', () => {
    expect(hasUpdate(null, served('/assets/index-zzz.js'))).toBe(false);
    expect(hasUpdate('/assets/index-abc.js', served(null))).toBe(false);
    expect(hasUpdate('/assets/index-abc.js', null)).toBe(false);
  });
});

describe('fetchBuild', () => {
  const ORIGIN = 'https://deck.test';
  beforeEach(() => vi.stubGlobal('location', { origin: ORIGIN }));
  afterEach(() => vi.unstubAllGlobals());

  // O manifesto decide qual código o app roda em seguida. Ler isso de outra origem
  // entregaria essa decisão a um terceiro; o caminho é sempre a origem atual.
  it('asks the app origin, with no cache and no credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entry: '/assets/index-abc.js', sha256: 'h', builtAt: 2 }) });
    vi.stubGlobal('fetch', fetchMock);
    expect((await fetchBuild())?.entry).toBe('/assets/index-abc.js');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${ORIGIN}/api/build`);
    expect(init).toMatchObject({ cache: 'no-store', credentials: 'omit' });
  });

  it('returns null on a non-ok response instead of prompting a reload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    expect(await fetchBuild()).toBeNull();
  });

  it('returns null when the network is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fetchBuild()).toBeNull();
  });

  it('rejects a body that is not a manifest', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: 'sem build' }) }));
    expect(await fetchBuild()).toBeNull();
  });
});
