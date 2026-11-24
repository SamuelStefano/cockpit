import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listSecrets, makeRedactor, putSecret, removeSecret, validVaultName, vaultEnvSync } from './vault';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'vault-'));
  process.env.COCKPIT_VAULT_FILE = join(dir, 'data', 'vault.enc');
  process.env.COCKPIT_VAULT_KEY_FILE = join(dir, 'keys', 'vault.key');
});
afterEach(() => {
  delete process.env.COCKPIT_VAULT_FILE;
  delete process.env.COCKPIT_VAULT_KEY_FILE;
  rmSync(dir, { recursive: true, force: true });
});

describe('vault', () => {
  it('stores encrypted at rest with 0600 files and never lists values', async () => {
    const r = await putSecret('GH_TOKEN', 'ghp_supersecretvalue', ['claude']);
    expect(r).toMatchObject({ name: 'GH_TOKEN', agents: ['claude'] });
    const raw = readFileSync(join(dir, 'data', 'vault.enc'), 'utf8');
    expect(raw).not.toContain('ghp_supersecretvalue');
    expect(statSync(join(dir, 'data', 'vault.enc')).mode & 0o777).toBe(0o600);
    expect(statSync(join(dir, 'keys', 'vault.key')).mode & 0o777).toBe(0o600);
    const list = listSecrets();
    expect(list).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain('supersecret');
  });

  it('injects only into agents on the allowlist', async () => {
    await putSecret('A_KEY', 'valueaaaaaa', ['claude']);
    await putSecret('B_KEY', 'valuebbbbbb', ['grok']);
    await putSecret('C_KEY', 'valuecccccc');
    expect(vaultEnvSync('claude')).toEqual({ A_KEY: 'valueaaaaaa' });
    expect(vaultEnvSync('grok')).toEqual({ B_KEY: 'valuebbbbbb' });
    expect(vaultEnvSync('other')).toEqual({});
  });

  it('keeps createdAt on overwrite and removes entries', async () => {
    const a = await putSecret('A_KEY', 'one-value', []);
    const b = await putSecret('A_KEY', 'two-value', []);
    expect('createdAt' in a && 'createdAt' in b && a.createdAt === b.createdAt).toBe(true);
    expect(await removeSecret('A_KEY')).toEqual({ ok: true });
    expect(listSecrets()).toEqual([]);
  });

  it('rejects bad names, reserved names, bad values and bad agents', async () => {
    for (const n of ['lower', '1ABC', 'A-B', 'PATH', 'HOME', 'ANTHROPIC_API_KEY', 'LD_PRELOAD', 'NODE_OPTIONS', 'ANTHROPIC_BASE_URL', 'HTTPS_PROXY', 'NO_PROXY', 'GIT_SSH_COMMAND', 'NODE_EXTRA_CA_CERTS', '__proto__', '']) {
      expect(validVaultName(n)).toBe(false);
    }
    expect(await putSecret('OK_NAME', '')).toHaveProperty('error');
    expect(await putSecret('OK_NAME', 'a\0b')).toHaveProperty('error');
    expect(await putSecret('OK_NAME', 'x'.repeat(20_000))).toHaveProperty('error');
    expect(await putSecret('OK_NAME', 'value', ['Bad Agent'])).toHaveProperty('error');
  });

  it('does not overwrite a corrupt vault with an empty one', async () => {
    await putSecret('A_KEY', 'one-value', ['claude']);
    const file = join(dir, 'data', 'vault.enc');
    writeFileSync(file, '{"v":1,"iv":"AAAA","tag":"AAAA","data":"AAAA"}');
    expect(await putSecret('B_KEY', 'other-value')).toEqual({ error: 'vault unavailable' });
    expect(readFileSync(file, 'utf8')).toContain('"data":"AAAA"');
    expect(vaultEnvSync('claude')).toEqual({});
  });
});

describe('makeRedactor', () => {
  it('masks raw and JSON-escaped values, longest first', () => {
    const redact = makeRedactor({ TOKEN: 'abc123def', MULTI: 'line1\nline2"q' });
    expect(redact('echo abc123def')).toBe('echo [vault:TOKEN]');
    const line = JSON.stringify({ text: 'line1\nline2"q and abc123def' });
    const out = redact(line);
    expect(out).not.toContain('abc123def');
    expect(JSON.parse(out).text).toBe('[vault:MULTI] and [vault:TOKEN]');
  });

  it('is a no-op without values and skips very short ones', () => {
    expect(makeRedactor({})('plain')).toBe('plain');
    expect(makeRedactor({ X: 'ab' })('ab ab')).toBe('ab ab');
  });
});
