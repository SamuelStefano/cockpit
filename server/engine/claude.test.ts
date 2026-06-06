import { describe, it, expect } from 'vitest';
import { sanitize, resolveMode } from './claude';

describe('sanitize', () => {
  it('masks /home paths so secret paths never leak', () => {
    expect(sanitize('ENOENT at /home/samuel/.claude/secret.json')).toBe('ENOENT at <path>');
  });

  it('leaves a clean message untouched', () => {
    expect(sanitize('spawn claude ENOENT')).toBe('spawn claude ENOENT');
  });

  it('caps the message at 300 chars', () => {
    expect(sanitize('x'.repeat(500)).length).toBe(300);
  });
});

describe('resolveMode', () => {
  it('plan mode grants no tools', () => {
    expect(resolveMode('plan')).toEqual({ permissionMode: 'plan', allow: [] });
  });

  it('auto mode uses the default permission with the shell-free allow-list', () => {
    const r = resolveMode('auto');
    expect(r.permissionMode).toBe('default');
    expect(r.allow).not.toContain('Bash');
  });

  it('acceptEdits mode allows the full edit tool-set', () => {
    const r = resolveMode('acceptEdits');
    expect(r.permissionMode).toBe('acceptEdits');
    expect(r.allow).toContain('Bash');
  });

  // CRÍTICO: nenhum modo pode resolver pra bypassPermissions (RCE root).
  it('never resolves to bypassPermissions for any input', () => {
    for (const m of ['plan', 'auto', 'acceptEdits', undefined, 'bypassPermissions', 'junk']) {
      expect(resolveMode(m).permissionMode).not.toBe('bypassPermissions');
    }
  });
});
