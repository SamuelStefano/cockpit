import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { parsePlanEvent, runOnPlan } from './plan-run';

// spawn mockado: o teste checa os ARGUMENTOS do CLI, nunca sobe processo de verdade.
vi.mock('node:child_process', () => ({ spawn: vi.fn() }));
vi.mock('../engine/cli-path', () => ({ cliPath: () => '/usr/bin' }));

function fakeChild() {
  const c = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: () => void };
  c.stdout = new EventEmitter();
  c.stderr = new EventEmitter();
  c.kill = () => {};
  return c;
}

describe('parsePlanEvent', () => {
  it('extrai delta de texto de um stream_event', () => {
    const ev = parsePlanEvent({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Oi' } } });
    expect(ev).toEqual({ kind: 'text', text: 'Oi' });
  });

  it('finaliza com sucesso: texto + tokens somados (cache conta na entrada)', () => {
    const ev = parsePlanEvent({
      type: 'result', subtype: 'success', is_error: false, result: 'resposta',
      usage: { input_tokens: 10, cache_creation_input_tokens: 9782, cache_read_input_tokens: 0, output_tokens: 40 },
    });
    expect(ev).toEqual({
      kind: 'final',
      result: { status: 'done', resultText: 'resposta', inputTokens: 9792, outputTokens: 40, error: undefined },
    });
  });

  it('finaliza com erro quando is_error', () => {
    const ev = parsePlanEvent({ type: 'result', subtype: 'error_during_execution', is_error: true, result: 'deu ruim', usage: {} });
    expect(ev).toMatchObject({ kind: 'final', result: { status: 'error', error: 'deu ruim' } });
  });

  it('ignora eventos que não são texto nem result', () => {
    expect(parsePlanEvent({ type: 'assistant', usage: {} })).toBeNull();
    expect(parsePlanEvent({ type: 'system' })).toBeNull();
  });
});

describe('least privilege do motor de plano', () => {
  // O prompt carrega transcript de sessao, que pode conter README/pagina/comentario
  // que o agente leu. Com o HOME herdado trazendo bypassPermissions, uma instrucao
  // plantada nesse texto rodaria sem confirmacao. O motor so devolve TEXTO.
  it('nasce sem tool nenhuma e sem bypass de permissao', () => {
    vi.mocked(spawn).mockReturnValue(fakeChild() as never);
    void runOnPlan({ model: 'claude-haiku-4-5-20251001', prompt: 'p', context: null, onEvent: () => {} });
    const args = vi.mocked(spawn).mock.calls.at(-1)![1] as string[];
    expect(args[args.indexOf('--allowed-tools') + 1]).toBe('');
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('default');
  });

  // O OAuth do plano so vale sem chave de API no env; uma chave herdada trocaria a
  // cota da assinatura por cobranca pay-as-you-go silenciosa.
  it('nao vaza ANTHROPIC_API_KEY pro CLI', () => {
    vi.mocked(spawn).mockReturnValue(fakeChild() as never);
    void runOnPlan({ model: 'm', prompt: 'p', context: null, onEvent: () => {} });
    const opts = vi.mocked(spawn).mock.calls.at(-1)![2] as { env: Record<string, string> };
    expect(opts.env).not.toHaveProperty('ANTHROPIC_API_KEY');
  });
});
