import { describe, it, expect, beforeEach, vi } from 'vitest';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
// class, não arrow: `new Anthropic()` precisa de um construtor de verdade.
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { create }; } }));

const { classify } = await import('./classifier');

function textResponse(text: string) {
  return { content: [{ type: 'text', text }] };
}

describe('classify', () => {
  beforeEach(() => create.mockReset());

  it('devolve o tier quando o modelo responde no schema', async () => {
    create.mockResolvedValue(textResponse(JSON.stringify({ tier: 'complex', reason: 'multi-passo' })));
    expect(await classify('k', 'refatorar o módulo inteiro')).toEqual({ tier: 'complex', reason: 'multi-passo' });
  });

  it('tier fora do enum cai no default seguro (medium, nunca simple às cegas)', async () => {
    create.mockResolvedValue(textResponse(JSON.stringify({ tier: 'trivial', reason: 'x' })));
    expect((await classify('k', 'oi')).tier).toBe('medium');
  });

  it('resposta não-json cai no default seguro', async () => {
    create.mockResolvedValue(textResponse('desculpe, não sei'));
    expect((await classify('k', 'oi')).tier).toBe('medium');
  });

  it('erro da API cai no default seguro (não derruba a task)', async () => {
    create.mockRejectedValueOnce(new Error('rede caiu'));
    expect((await classify('k', 'oi')).tier).toBe('medium');
  });
});
