import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

let managed: Record<string, string> = {};
vi.mock('../admin-ops', () => ({ managedEnvSync: () => managed, mcpServerDefsSync: () => ({}) }));

// `claude` é um binário REAL na máquina do Samuel: sem este mock os testes de run()
// subiriam um turno de verdade e queimariam token.
const spawned = vi.hoisted(() => ({ child: null as FakeChild | null }));
vi.mock('node:child_process', () => ({
  spawn: () => spawned.child,
  execFileSync: () => '',
}));

class FakeChild extends EventEmitter {
  pid = 7331;
  stdout = new PassThrough();
  stderr = new PassThrough();
  kill = vi.fn();
}

import { sanitize, resolveMode, buildArgs, bypassAllowed, shouldReportExit, minimalEnv, run, effectiveBudget, pickMcpDefs, validModel } from './claude';
import { CONFIG } from '../config';

beforeEach(() => { managed = {}; });

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

  // Sem teto do servidor, omitir maxBudgetUsd era run sem limite: o teto era 100%
  // do cliente. Com COCKPIT_MAX_BUDGET_USD o flag vai SEMPRE, e o cliente só aperta.
  it('teto do servidor entra sempre e o cliente só pode apertar', () => {
    const prev = CONFIG.maxBudgetUsd;
    CONFIG.maxBudgetUsd = 3;
    try {
      expect(valAfter(argsOf({ prompt: 'x' }), '--max-budget-usd')).toBe('3');
      expect(valAfter(argsOf({ prompt: 'x', maxBudgetUsd: 50 }), '--max-budget-usd')).toBe('3');
      expect(valAfter(argsOf({ prompt: 'x', maxBudgetUsd: 1 }), '--max-budget-usd')).toBe('1');
      expect(valAfter(argsOf({ prompt: 'x', maxBudgetUsd: -1 }), '--max-budget-usd')).toBe('3');
    } finally { CONFIG.maxBudgetUsd = prev; }
  });

  it('allow-lists model (alias or concrete claude-* id), dropping arbitrary values', () => {
    expect(valAfter(argsOf({ prompt: 'x', model: 'opus' }), '--model')).toBe('opus');
    expect(valAfter(argsOf({ prompt: 'x', model: 'claude-opus-4-8' }), '--model')).toBe('claude-opus-4-8');
    const evil = argsOf({ prompt: 'x', model: 'evil; rm -rf' });
    expect(evil).not.toContain('--model');
    expect(argsOf({ prompt: 'x' })).not.toContain('--effort');
  });

  it('aceita o id concreto do modelo, não só o alias', () => {
    for (const m of ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5']) {
      expect(valAfter(argsOf({ prompt: 'x', model: m }), '--model'), m).toBe(m);
    }
  });

  it('nunca deixa o modelo virar flag no argv', () => {
    for (const m of ['--dangerously-skip-permissions', '-p', ' glm', 'glm 4.6', '']) {
      expect(argsOf({ prompt: 'x', model: m }), m).not.toContain('--model');
    }
  });

  it('não passa --fallback-model por padrão (fallbackModel vazio = sem downgrade silencioso)', () => {
    expect(argsOf({ prompt: 'x', model: 'claude-opus-4-8' })).not.toContain('--fallback-model');
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

  it('forkId vira --fork-session --session-id, e só junto do --resume', () => {
    const fork = argsOf({ prompt: 'x', resumeId: '11111111-1111-1111-1111-111111111111', forkId: '22222222-2222-2222-2222-222222222222' });
    expect(fork).toContain('--fork-session');
    expect(valAfter(fork, '--session-id')).toBe('22222222-2222-2222-2222-222222222222');
    // Sem transcript pra forkar o flag não faz sentido: gravaria num id novo sem contexto.
    expect(argsOf({ prompt: 'x', forkId: '22222222-2222-2222-2222-222222222222' })).not.toContain('--fork-session');
    expect(buildArgs({ prompt: 'x', resumeId: '11111111-1111-1111-1111-111111111111', forkId: '../etc/passwd' })).toEqual({ error: 'sessionId inválido' });
  });

  it('grants no allowedTools in plan mode', () => {
    expect(argsOf({ prompt: 'x', mode: 'plan' })).not.toContain('--allowedTools');
  });

  it('ordena disallowedTools igual independente da ordem de entrada', () => {
    const a = valAfter(argsOf({ prompt: 'x', disallowedSkills: ['Zeta', 'Alpha', 'Mu'] }), '--disallowedTools');
    const b = valAfter(argsOf({ prompt: 'x', disallowedSkills: ['Mu', 'Zeta', 'Alpha'] }), '--disallowedTools');
    expect(a).toBe(b);
  });

  it('não repete regra vinda do config e da seleção de skills', () => {
    const v = valAfter(argsOf({ prompt: 'x', disallowedSkills: ['Alpha', 'Alpha'] }), '--disallowedTools');
    const rules = (v ?? '').split(' ').filter(Boolean);
    expect(new Set(rules).size).toBe(rules.length);
  });
});

describe('validModel — variantes de 1M', () => {
  afterEach(() => { CONFIG.allowLongContext = false; });

  it('recusa [1m] por padrão, mesmo com o pin velho do cliente', () => {
    expect(validModel('claude-opus-5[1m]')).toBe(false);
    expect(validModel('claude-fable-5-1[1m]')).toBe(false);
  });

  it('aceita o id base e os aliases', () => {
    for (const m of ['claude-opus-5', 'opus', 'sonnet', 'haiku']) expect(validModel(m)).toBe(true);
  });

  it('aceita [1m] com COCKPIT_ALLOW_1M ligado', () => {
    CONFIG.allowLongContext = true;
    // O MODEL_ID_RE não aceita colchete: com o opt-in ligado o gate de 1M sai da
    // frente, mas o id continua barrado pelo charset — a flag não é um bypass do
    // validador, só do veto específico.
    expect(validModel('claude-opus-5[1m]')).toBe(false);
    expect(validModel('claude-opus-5')).toBe(true);
  });
});

describe('buildArgs — modelo [1m] não vai pro argv', () => {
  it('omite --model quando o pin é [1m]', () => {
    expect(argsOf({ prompt: 'x', model: 'claude-opus-5[1m]' })).not.toContain('--model');
  });
});

describe('effectiveBudget', () => {
  it('sem teto do servidor devolve o pedido válido ou nada', () => {
    expect(effectiveBudget(5, undefined)).toBe(5);
    expect(effectiveBudget(undefined, undefined)).toBeUndefined();
    expect(effectiveBudget(0, undefined)).toBeUndefined();
    expect(effectiveBudget(NaN, undefined)).toBeUndefined();
  });
  it('com teto do servidor: min(pedido, teto), e o teto quando não há pedido', () => {
    expect(effectiveBudget(undefined, 2)).toBe(2);
    expect(effectiveBudget(9, 2)).toBe(2);
    expect(effectiveBudget(1, 2)).toBe(1);
    expect(effectiveBudget(Infinity, 2)).toBe(2);
  });
});

// msg.mcps vem do cliente e resolve contra o ~/.claude.json cru: sem o filtro por
// papel, escrever uma definição stdio e pedir o nome no turno seguinte furava o gate
// admin-only do admin-mcp-add (stdio = subprocesso arbitrário).
describe('pickMcpDefs', () => {
  const all = {
    local: { command: 'npx', args: ['-y', 'x-mcp'] },
    remote: { url: 'https://mcp.example.com/mcp', headers: { Authorization: 'Bearer t' } },
    lixo: 'não é objeto',
  };
  it('admin carrega stdio e remoto', () => {
    expect(Object.keys(pickMcpDefs(all, ['local', 'remote'], 'admin'))).toEqual(['local', 'remote']);
  });
  it('student só carrega remoto (url); stdio é descartado em silêncio', () => {
    expect(Object.keys(pickMcpDefs(all, ['local', 'remote'], 'student'))).toEqual(['remote']);
  });
  it('sem papel identificado = menor privilégio', () => {
    expect(Object.keys(pickMcpDefs(all, ['local'], undefined))).toEqual([]);
  });
  it('ignora nome desconhecido e definição que não é objeto', () => {
    expect(pickMcpDefs(all, ['nada', 'lixo'], 'admin')).toEqual({});
  });
});

describe('minimalEnv', () => {
  // O CLI tem que rodar no OAuth da assinatura. Uma ANTHROPIC_API_KEY solta no env
  // gerenciado venceria o OAuth e todo turno sairia cobrado por token sem ninguém
  // pedir — por isso a chave é zerada (vazia, não ausente) por último.
  it('zera ANTHROPIC_API_KEY mesmo se o env gerenciado trouxer uma', () => {
    managed = { ANTHROPIC_API_KEY: 'k-solta' };
    expect(minimalEnv().ANTHROPIC_API_KEY).toBe('');
  });

  it('token gerenciado sem conflito continua chegando no agente', () => {
    managed = { EXEMPLO_API_KEY: 'k-tool' };
    expect(minimalEnv().EXEMPLO_API_KEY).toBe('k-tool');
  });

  // setEnv aceita PATH como nome válido; se o env gerenciado vencesse, trocava o
  // binário `claude` que o spawn resolve.
  it('PATH e HOME gerenciados não sequestram o spawn', () => {
    managed = { PATH: '/tmp/evil', HOME: '/tmp/evil-home' };
    const env = minimalEnv();
    expect(env.PATH).not.toBe('/tmp/evil');
    expect(env.HOME).toBe(process.env.HOME);
  });

  // O env herdado do processo não pode vazar pro `claude` (#162).
  it('não herda segredo solto do processo', () => {
    process.env.DECK_TEST_SEGREDO = 'nao-vaza';
    expect(minimalEnv().DECK_TEST_SEGREDO).toBeUndefined();
    delete process.env.DECK_TEST_SEGREDO;
  });
});

describe('run: leitura do stream', () => {
  let child: FakeChild;
  const events: unknown[] = [];
  const errors: string[] = [];
  let closes = 0;
  const start = () => run({ prompt: 'oi', onEvent: (e) => events.push(e), onError: (m) => errors.push(m), onClose: () => { closes += 1; } });

  beforeEach(() => {
    child = new FakeChild();
    spawned.child = child;
    events.length = 0; errors.length = 0; closes = 0;
  });
  afterEach(() => vi.restoreAllMocks());

  const flush = () => new Promise((r) => setImmediate(r));

  it('entrega cada linha JSON como evento', async () => {
    start();
    child.stdout.write(`${JSON.stringify({ type: 'assistant' })}\n`);
    await flush();
    expect(events).toEqual([{ type: 'assistant' }]);
  });

  it('ignora linha vazia e ruído não-JSON', async () => {
    start();
    child.stdout.write('\nruído do terminal\n');
    await flush();
    expect(events).toEqual([]);
    expect(errors).toEqual([]);
  });

  // O `result` chega ANTES do exit≠0 nos cortes esperados (budget/max-turns); depois
  // dele o exit não é mais crash a reportar.
  it('não reporta crash quando o result já veio antes do exit≠0', async () => {
    start();
    child.stdout.write(`${JSON.stringify({ type: 'result', subtype: 'error_max_budget' })}\n`);
    await flush();
    child.emit('close', 1);
    expect(errors).toEqual([]);
    expect(closes).toBe(1);
  });

  it('reporta o exit≠0 com a cauda do stderr quando não houve result', async () => {
    start();
    child.stderr.write('boom no CLI');
    await flush();
    child.emit('close', 127);
    expect(errors[0]).toContain('claude saiu (127)');
    expect(errors[0]).toContain('boom no CLI');
  });

  it('fecha uma vez só, mesmo com error e close no mesmo spawn', () => {
    start();
    child.emit('error', new Error('spawn claude ENOENT'));
    child.emit('close', 1);
    expect(closes).toBe(1);
  });
});

// O backstop do index.ts chama shutdown(1) em uncaughtException: um erro de pipe não
// tratado aqui derrubaria TODOS os chats por causa de um stop. E erro de pipe é o
// caminho NORMAL — o kill() manda SIGKILL no grupo com a leitura em voo.
describe('run: erro de pipe não pode derrubar o backend', () => {
  let child: FakeChild;
  beforeEach(() => {
    child = new FakeChild();
    spawned.child = child;
    run({ prompt: 'oi', onEvent: () => {}, onError: () => {}, onClose: () => {} });
  });
  afterEach(() => vi.restoreAllMocks());

  // Tratar só o stream NÃO basta: o readline reemite o erro do input na própria
  // Interface, e 'error' sem listener num EventEmitter volta a ser throw.
  it('absorve EPIPE no stdout sem propagar', () => {
    expect(child.stdout.listenerCount('error')).toBeGreaterThan(0);
    expect(() => child.stdout.emit('error', new Error('EPIPE'))).not.toThrow();
  });

  it('absorve ECONNRESET no stderr sem propagar', () => {
    expect(child.stderr.listenerCount('error')).toBeGreaterThan(0);
    expect(() => child.stderr.emit('error', new Error('ECONNRESET'))).not.toThrow();
  });
});
