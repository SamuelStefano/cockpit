import { describe, it, expect } from 'vitest';
import { sanitize, resolveMode, buildArgs, bypassAllowed, shouldReportExit } from './claude';

function argsOf(o: Parameters<typeof buildArgs>[0]): string[] {
  const r = buildArgs(o);
  if ('error' in r) throw new Error(r.error);
  return r.args;
}
function valAfter(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

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

describe('shouldReportExit', () => {
  it('reports genuine non-zero crashes (not killed)', () => {
    expect(shouldReportExit(false, 1)).toBe(true);
    expect(shouldReportExit(false, 127)).toBe(true);
  });

  it('stays silent on clean exit and signal-less close', () => {
    expect(shouldReportExit(false, 0)).toBe(false);
    expect(shouldReportExit(false, null)).toBe(false);
  });

  // Stop do usuário: nosso kill() leva o claude a sair com 143 (SIGTERM) / 137
  // (SIGKILL). Com killed=true nenhum desses pode virar o banner "turno falhou".
  it('never reports an exit caused by our own kill, whatever the code', () => {
    for (const c of [143, 137, 1, 0, null]) {
      expect(shouldReportExit(true, c)).toBe(false);
    }
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

  // Gate fechado por default (CONFIG.allowBypass=false em teste): nem com pedido
  // explícito de bypass + role admin o modo pode virar bypassPermissions.
  it('never resolves to bypassPermissions when the server flag is off (default)', () => {
    for (const m of ['plan', 'auto', 'acceptEdits', undefined]) {
      expect(resolveMode(m, { bypass: true, role: 'admin' }).permissionMode).not.toBe('bypassPermissions');
    }
  });
});

// O gate é a única porta pro bypass: precisa das QUATRO condições simultâneas.
describe('bypassAllowed', () => {
  const ok = { allowBypass: true, localOnly: true };

  it('permite só com pedido + role admin + flag on + deploy local-confiável', () => {
    expect(bypassAllowed({ bypass: true, role: 'admin' }, ok)).toBe(true);
  });

  it('nega sem pedido explícito de bypass', () => {
    expect(bypassAllowed({ bypass: false, role: 'admin' }, ok)).toBe(false);
    expect(bypassAllowed({ role: 'admin' }, ok)).toBe(false);
    expect(bypassAllowed(undefined, ok)).toBe(false);
  });

  it('nega pra qualquer role que não seja admin (student NUNCA)', () => {
    expect(bypassAllowed({ bypass: true, role: 'student' }, ok)).toBe(false);
    expect(bypassAllowed({ bypass: true }, ok)).toBe(false);
  });

  it('nega com a flag de servidor desligada', () => {
    expect(bypassAllowed({ bypass: true, role: 'admin' }, { allowBypass: false, localOnly: true })).toBe(false);
  });

  it('nega num deploy não-local (sem auth real, não expõe bypass)', () => {
    expect(bypassAllowed({ bypass: true, role: 'admin' }, { allowBypass: true, localOnly: false })).toBe(false);
  });
});

describe('buildArgs', () => {
  it('always sends the headless stream-json base flags', () => {
    const args = argsOf({ prompt: 'hi' });
    expect(valAfter(args, '-p')).toBe('hi');
    expect(valAfter(args, '--output-format')).toBe('stream-json');
    expect(args).toContain('--include-partial-messages');
  });

  it('never passes bypassPermissions for any requested mode', () => {
    for (const m of ['plan', 'auto', 'acceptEdits', 'bypassPermissions', 'junk', undefined]) {
      expect(valAfter(argsOf({ prompt: 'x', mode: m }), '--permission-mode')).not.toBe('bypassPermissions');
    }
  });

  it('includes the budget cap only when finite and positive', () => {
    expect(valAfter(argsOf({ prompt: 'x', maxBudgetUsd: 5 }), '--max-budget-usd')).toBe('5');
    for (const bad of [0, -1, NaN, Infinity, undefined]) {
      expect(argsOf({ prompt: 'x', maxBudgetUsd: bad as number })).not.toContain('--max-budget-usd');
    }
  });

  it('allow-lists model (alias or concrete claude-* id), dropping arbitrary values', () => {
    expect(valAfter(argsOf({ prompt: 'x', model: 'opus' }), '--model')).toBe('opus');
    expect(valAfter(argsOf({ prompt: 'x', model: 'claude-opus-4-8' }), '--model')).toBe('claude-opus-4-8');
    const evil = argsOf({ prompt: 'x', model: 'evil; rm -rf' });
    expect(evil).not.toContain('--model');
    expect(argsOf({ prompt: 'x' })).not.toContain('--effort');
  });

  it('adds --resume for a valid uuid and aborts on a malformed one', () => {
    const ok = argsOf({ prompt: 'x', resumeId: '11111111-1111-1111-1111-111111111111' });
    expect(valAfter(ok, '--resume')).toBe('11111111-1111-1111-1111-111111111111');
    expect(buildArgs({ prompt: 'x', resumeId: '../etc/passwd' })).toEqual({ error: 'sessionId inválido' });
  });

  it('grants no allowedTools in plan mode', () => {
    expect(argsOf({ prompt: 'x', mode: 'plan' })).not.toContain('--allowedTools');
  });
});
