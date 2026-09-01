import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HarnessEvent } from '../../shared/protocol';

const env = vi.hoisted(() => ({ value: {} as Record<string, string> }));
vi.mock('../admin-ops', () => ({ managedEnvSync: () => env.value }));

const classify = vi.hoisted(() => vi.fn());
vi.mock('./classifier', () => ({ classify }));

const runOnPlan = vi.hoisted(() => vi.fn());
vi.mock('./plan-run', () => ({ runOnPlan }));

// Captura o que foi pedido à API e devolve uma final message controlada, sem rede.
const sdk = vi.hoisted(() => ({
  sent: [] as Array<Record<string, unknown>>,
  final: null as unknown,
  throws: null as Error | null,
}));

vi.mock('@anthropic-ai/sdk', () => {
  function stream(body: Record<string, unknown>) {
    sdk.sent.push(body);
    return {
      on: () => {},
      finalMessage: async () => { if (sdk.throws) throw sdk.throws; return sdk.final; },
    };
  }
  class Anthropic {
    messages = { stream };
    beta = { messages: { stream } };
    static APIError = class extends Error {};
  }
  return { default: Anthropic };
});

const { runTask } = await import('./run');

function events() {
  const list: HarnessEvent[] = [];
  return { list, onEvent: (e: HarnessEvent) => { list.push(e); } };
}

function finalMessage(text: string, usage: Record<string, number> = {}) {
  return {
    content: [{ type: 'text', text }],
    usage: { input_tokens: 1000, output_tokens: 1000, ...usage },
    stop_reason: 'end_turn',
  };
}

beforeEach(() => {
  env.value = { ANTHROPIC_API_KEY: 'sk-test' };
  sdk.sent = [];
  sdk.final = finalMessage('resposta');
  sdk.throws = null;
  classify.mockReset();
  runOnPlan.mockReset();
});

describe('runTask: portões antes de gastar', () => {
  it('não classifica sem ANTHROPIC_API_KEY e diz onde configurar', async () => {
    env.value = {};
    const { list, onEvent } = events();
    const r = await runTask({ prompt: 'p', choice: { mode: 'auto', via: 'api' }, context: null, onEvent });
    expect(r.status).toBe('error');
    expect(r.error).toContain('painel de env');
    expect(classify).not.toHaveBeenCalled();
    expect(list).toEqual([{ kind: 'error', message: r.error }]);
  });

  it('recusa modelo nativo desconhecido antes de abrir stream', async () => {
    const { onEvent } = events();
    const r = await runTask({ prompt: 'p', choice: { mode: 'model', model: 'gpt-9', via: 'api' }, context: null, onEvent });
    expect(r.status).toBe('error');
    expect(r.error).toContain('modelo nativo desconhecido');
    expect(sdk.sent).toHaveLength(0);
  });

  it('recusa orquestrado com modelo não-nativo', async () => {
    const { onEvent } = events();
    const r = await runTask({ prompt: 'p', choice: { mode: 'orchestrated', executor: 'gpt-9', advisor: 'claude-opus-4-8' }, context: null, onEvent });
    expect(r.status).toBe('error');
    expect(r.error).toContain('só modelos nativos');
    expect(sdk.sent).toHaveLength(0);
  });
});

describe('runTask: auto usa o tier do classificador', () => {
  it('mapeia o tier sugerido pro modelo nativo e anuncia os dois', async () => {
    classify.mockResolvedValue({ tier: 'simple', reason: 'pergunta curta' });
    const { list, onEvent } = events();
    const r = await runTask({ prompt: 'p', choice: { mode: 'auto', via: 'api' }, context: null, onEvent });
    expect(r.model).toBe('claude-haiku-4-5');
    expect(r.tier).toBe('simple');
    expect(list).toContainEqual({ kind: 'classified', tier: 'simple', reason: 'pergunta curta' });
    expect(list).toContainEqual({ kind: 'model-selected', model: 'claude-haiku-4-5' });
  });
});

describe('runTask: caminho de plano', () => {
  it('delega ao CLI e carimba custo 0 (roda na cota do plano)', async () => {
    runOnPlan.mockResolvedValue({ status: 'done', resultText: 'ok', inputTokens: 10, outputTokens: 20 });
    const { list, onEvent } = events();
    const r = await runTask({ prompt: 'p', choice: { mode: 'model', model: 'claude-opus-4-8', via: 'plan' }, context: null, onEvent });
    expect(r).toMatchObject({ via: 'plan', status: 'done', costUsd: 0, resultText: 'ok' });
    expect(sdk.sent).toHaveLength(0);
    expect(list).toContainEqual({ kind: 'done', costUsd: 0 });
  });

  it('erro no plano não vira custo 0 fantasma', async () => {
    runOnPlan.mockResolvedValue({ status: 'error', error: 'CLI morreu', inputTokens: 0, outputTokens: 0 });
    const { onEvent } = events();
    const r = await runTask({ prompt: 'p', choice: { mode: 'model', model: 'claude-opus-4-8', via: 'plan' }, context: null, onEvent });
    expect(r.status).toBe('error');
    expect(r.costUsd).toBeUndefined();
  });
});

describe('runTask: custo e resultado da API', () => {
  it('soma cache no input reportado e calcula o custo pelo modelo', async () => {
    sdk.final = finalMessage('oi', { input_tokens: 1_000_000, output_tokens: 0, cache_read_input_tokens: 500_000 });
    const { onEvent } = events();
    const r = await runTask({ prompt: 'p', choice: { mode: 'model', model: 'claude-opus-4-8', via: 'api' }, context: null, onEvent });
    expect(r.inputTokens).toBe(1_500_000);
    expect(r.costUsd).toBeCloseTo(15 + 0.75, 6); // 1M input opus + 500k cache read
  });

  // REGRESSÃO: o orquestrado passava o RÓTULO "executor+advisor" pra tabela de
  // preço, e `priceOf` casa por substring com opus antes de haiku — um executor
  // haiku com advisor opus era cobrado a preço de opus (~19× o input).
  it('cobra o orquestrado pelo executor, não pelo rótulo com o advisor', async () => {
    sdk.final = finalMessage('oi', { input_tokens: 1_000_000, output_tokens: 0 });
    const { onEvent } = events();
    const r = await runTask({
      prompt: 'p',
      choice: { mode: 'orchestrated', executor: 'claude-haiku-4-5', advisor: 'claude-opus-4-8' },
      context: null, onEvent,
    });
    expect(r.costUsd).toBeCloseTo(0.8, 6); // preço de haiku, não os 15 do opus
    expect(r.model).toBe('claude-haiku-4-5+claude-opus-4-8'); // rótulo segue completo
  });

  it('mostra a recusa do modelo como resultado, não como erro do harness', async () => {
    sdk.final = { content: [], usage: { input_tokens: 5, output_tokens: 0 }, stop_reason: 'refusal' };
    const { onEvent } = events();
    const r = await runTask({ prompt: 'p', choice: { mode: 'model', model: 'claude-opus-4-8', via: 'api' }, context: null, onEvent });
    expect(r.status).toBe('done');
    expect(r.resultText).toContain('recusou');
  });

  it('erro da API vira status error com a mensagem, sem custo', async () => {
    sdk.throws = new Error('overloaded');
    const { list, onEvent } = events();
    const r = await runTask({ prompt: 'p', choice: { mode: 'model', model: 'claude-opus-4-8', via: 'api' }, context: null, onEvent });
    expect(r).toMatchObject({ status: 'error', error: 'overloaded', model: 'claude-opus-4-8' });
    expect(r.costUsd).toBeUndefined();
    expect(list).toContainEqual({ kind: 'error', message: 'overloaded' });
  });
});
