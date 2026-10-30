import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { ensureHome, npmInvocation, platformEnv } from './platform';
import { cliInDir, resolveCli } from './engine/cli-path';

describe('platform helpers', () => {
  it('fills HOME only on Windows and never overrides it', () => {
    const env: NodeJS.ProcessEnv = {};
    ensureHome(env, false);
    expect(env.HOME).toBeUndefined();
    ensureHome(env, true);
    expect(env.HOME).toBeTruthy();
    const set: NodeJS.ProcessEnv = { HOME: '/x' };
    ensureHome(set, true);
    expect(set.HOME).toBe('/x');
  });

  it('passes the Windows env only on Windows', () => {
    expect(platformEnv({ SystemRoot: 'C:\\Windows', SECRET: 'x' }, false)).toEqual({});
    expect(platformEnv({ SystemRoot: 'C:\\Windows', SECRET: 'x' }, true)).toEqual({ SystemRoot: 'C:\\Windows' });
  });

  it('runs npm through node on Windows, since a .cmd cannot spawn without a shell', () => {
    const cli = join('/node', 'node_modules', 'npm', 'bin', 'npm-cli.js');
    expect(npmInvocation('npm', ['ci'], '/node/node', true, () => true)).toEqual(['/node/node', [cli, 'ci']]);
    expect(npmInvocation('npm', ['ci'], '/node/node', false, () => true)).toEqual(['npm', ['ci']]);
    expect(npmInvocation('git', ['pull'], '/node/node', true, () => true)).toEqual(['git', ['pull']]);
  });
});

describe('claude on Windows', () => {
  const shimmed = join('/npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');

  it('resolves the npm shim to the exe behind it', () => {
    const has = new Set([join('/npm', 'claude.cmd'), shimmed]);
    expect(cliInDir('/npm', (p) => has.has(p), true)).toBe(shimmed);
  });

  it('ignores a shim without its exe and the extensionless sh script', () => {
    expect(cliInDir('/npm', (p) => p === join('/npm', 'claude.cmd') || p === join('/npm', 'claude'), true)).toBe('');
  });

  it('prefers a native exe and splits PATH on semicolons', () => {
    const exe = join('/native', 'claude.exe');
    expect(resolveCli('/empty;/native', (p) => p === exe, true)).toBe(exe);
  });
});
