import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { byoKeyViews, fileKeyStore, removeByoKey, saveByoKey } from './byo-keys';

const root = mkdtempSync(join(tmpdir(), 'deck-byo-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('byo key store', () => {
  it('stores keys in a 0600 file and never echoes them back', () => {
    const path = join(root, 'sub', 'keys.json');
    const store = fileKeyStore(path);
    expect(saveByoKey(store, 'deepseek', ' sk-secret-value-1234 ').ok).toBe(true);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(readFileSync(path, 'utf8')).toContain('sk-secret-value-1234');
    const views = byoKeyViews(store);
    expect(views.find((v) => v.provider === 'deepseek')).toEqual({ provider: 'deepseek', configured: true, last4: '1234' });
    expect(views.find((v) => v.provider === 'zai')).toEqual({ provider: 'zai', configured: false });
    expect(JSON.stringify(views)).not.toContain('secret');
  });

  it('rejects unknown providers and malformed keys', () => {
    const store = fileKeyStore(join(root, 'k2.json'));
    expect(saveByoKey(store, 'nope', 'sk-abcdefgh').ok).toBe(false);
    expect(saveByoKey(store, 'zai', 'has space inside').ok).toBe(false);
    expect(saveByoKey(store, 'zai', 'x').ok).toBe(false);
    expect(store.get('zai')).toBeUndefined();
  });

  it('keeps other providers when removing one', () => {
    const store = fileKeyStore(join(root, 'k3.json'));
    saveByoKey(store, 'zai', 'zai-key-123456');
    saveByoKey(store, 'openrouter', 'or-key-123456');
    expect(removeByoKey(store, 'zai').ok).toBe(true);
    expect(store.get('zai')).toBeUndefined();
    expect(store.get('openrouter')).toBe('or-key-123456');
  });

  it('treats a corrupt file as empty', () => {
    expect(fileKeyStore(join(root, 'missing.json')).get('zai')).toBeUndefined();
  });
});
