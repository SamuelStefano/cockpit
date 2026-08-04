import { describe, it, expect, vi, beforeEach } from 'vitest';

let managed: Record<string, string> = {};
let route: Record<string, string> = {};
vi.mock('../admin-ops', () => ({ managedEnvSync: () => managed, mcpServerDefsSync: () => ({}) }));
vi.mock('../router/state', () => ({
  routeEnv: () => route,
  routeModel: (m?: string) => m,
  routeIsNativeAnthropic: () => true,
}));

import { sanitize, resolveMode, buildArgs, bypassAllowed, shouldReportExit, minimalEnv } from './claude';

beforeEach(() => { managed = {}; route = {}; });

function argsOf(o: Parameters<typeof buildArgs>[0]): string[] {
  const r = buildArgs(o);
  if ('error' in r) throw new Error(r.error);
  return r.args;
}
function valAfter(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

describe('buildArgs MCP', () => {
  it('sempre passa --strict-mcp-config (default = nenhum MCP, corta ~37k tokens/chamada)', () => {
    const args = argsOf({ prompt: 'oi' });
    expect(args).toContain('--strict-mcp-config');
    expect(args).not.toContain('--mcp-config');
  });
  it('inclui --mcp-config <path> quando há MCP escolhido pra sessão', () => {
    const r = buildArgs({ prompt: 'oi' }, '/tmp/deck-mcp-abc.json');
    if ('error' in r) throw new Error(r.error);
    expect(r.args).toContain('--strict-mcp-config');
    expect(valAfter(r.args, '--mcp-config')).toBe('/tmp/deck-mcp-abc.json');
  });
});

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

  // Corte gracioso (budget/max-turns): o claude emite `result` e DEPOIS sai com
  // code=1. Com sawResult=true esse exit não pode virar "claude saiu (1)" por
  // cima do banner "teto atingido / Continuar".
  it('never reports a non-zero exit once a result event was already seen', () => {
    expect(shouldReportExit(false, 1, true)).toBe(false);
    expect(shouldReportExit(false, 137, true)).toBe(false);
  });

  // Crash genuíno (sem result): segue reportando.
  it('still reports a non-zero exit when no result was seen', () => {
    expect(shouldReportExit(false, 1, false)).toBe(true);
    expect(shouldReportExit(false, 127, false)).toBe(true);
  });
});

describe('resolveMode', () => {
  it('plan mode grants no tools', () => {
    expect(resolveMode('plan')).toEqual({ permissionMode: 'plan', allow: [] });
  });

  it('auto mode uses the default permission and now includes Bash (ciclo autônomo)', () => {
    const r = resolveMode('auto');
    expect(r.permissionMode).toBe('default');
    expect(r.allow).toContain('Bash');
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

  it('aceita o id nativo do provedor roteado (glm-4.6, qwen3-coder-plus, MiniMax-M2)', () => {
    for (const m of ['glm-4.6', 'qwen3-coder-plus', 'MiniMax-M2', 'deepseek-chat', 'openai/gpt-oss-120b']) {
      expect(valAfter(argsOf({ prompt: 'x', model: m }), '--model'), m).toBe(m);
    }
  });

  it('nunca deixa o modelo virar flag no argv', () => {
    for (const m of ['--dangerously-skip-permissions', '-p', ' glm', 'glm 4.6', '']) {
      expect(argsOf({ prompt: 'x', model: m }), m).not.toContain('--model');
    }
  });

  it('suprime --fallback-model fora da Anthropic (o nome não existe no outro provedor)', () => {
    expect(argsOf({ prompt: 'x', model: 'claude-opus-4-8' })).toContain('--fallback-model');
    expect(argsOf({ prompt: 'x', model: 'glm-4.6', nativeAnthropic: false })).not.toContain('--fallback-model');
  });

  it('allow-lists effort, dropping unknown levels', () => {
    for (const e of ['low', 'medium', 'high', 'xhigh', 'max']) {
      expect(valAfter(argsOf({ prompt: 'x', effort: e }), '--effort')).toBe(e);
    }
    for (const bad of ['turbo', 'LOW', 'evil; rm', '']) {
      expect(argsOf({ prompt: 'x', effort: bad })).not.toContain('--effort');
    }
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

// O spawn é o único ponto onde a decisão do roteador vira comportamento: se o env
// não sair com o BASE_URL/token do provedor escolhido, o turno inteiro continua
// batendo na Anthropic e todo o resto do roteador é decoração.
describe('minimalEnv', () => {
  it('injeta o env da rota ativa', () => {
    route = { ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic', ANTHROPIC_AUTH_TOKEN: 'k-zai' };
    const env = minimalEnv();
    expect(env.ANTHROPIC_BASE_URL).toBe('https://api.z.ai/api/anthropic');
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe('k-zai');
  });

  it('rota no plano não injeta nada da Anthropic', () => {
    expect(minimalEnv().ANTHROPIC_BASE_URL).toBeUndefined();
  });

  // URL de um provedor com a chave de outro = turno morto em 401 (ou pior: chave
  // vazada pro endpoint errado). A rota tem que vencer o env gerenciado.
  it('rota vence o env gerenciado no conflito', () => {
    managed = { ANTHROPIC_BASE_URL: 'https://api.moonshot.ai/anthropic', ANTHROPIC_API_KEY: 'k-antiga' };
    route = { ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic', ANTHROPIC_API_KEY: 'k-zai' };
    const env = minimalEnv();
    expect(env.ANTHROPIC_BASE_URL).toBe('https://api.z.ai/api/anthropic');
    expect(env.ANTHROPIC_API_KEY).toBe('k-zai');
  });

  it('token gerenciado sem conflito continua chegando no agente', () => {
    managed = { DASHSCOPE_API_KEY: 'k-qwen' };
    expect(minimalEnv().DASHSCOPE_API_KEY).toBe('k-qwen');
  });

  // O env herdado do processo não pode vazar pro `claude` (#162).
  it('não herda segredo solto do processo', () => {
    process.env.DECK_TEST_SEGREDO = 'nao-vaza';
    expect(minimalEnv().DECK_TEST_SEGREDO).toBeUndefined();
    delete process.env.DECK_TEST_SEGREDO;
  });
});
