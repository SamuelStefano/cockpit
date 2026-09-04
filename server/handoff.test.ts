import { describe, it, expect, vi, beforeEach } from 'vitest';
import { distill, handoffSlug, handoffPrompt, parseHandoffResponse, handoffDescription, handoffFile, headTail } from './handoff';
import type { Message } from '../shared/protocol';
import { runOnPlan } from './harness/plan-run';
import { apiKey } from './summary';

vi.mock('./harness/plan-run', () => ({ runOnPlan: vi.fn() }));
vi.mock('./summary', async (orig) => ({ ...(await orig<typeof import('./summary')>()), apiKey: vi.fn() }));
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const at = new Date('2026-07-31T23:30:00Z'); // 20:30 BRT do mesmo dia

describe('handoffSlug', () => {
  it('carimba o dia em BRT, não em UTC', () => {
    // 02:00Z de 01/08 ainda é 31/07 em Maringá — o slug tem que seguir o usuário.
    expect(handoffSlug('107cef43-aaaa', new Date('2026-08-01T02:00:00Z'))).toBe('handoff-20260731-107cef43');
  });

  it('sanitiza o id e cabe no allow-list de slug', () => {
    expect(handoffSlug('../../etc/passwd', at)).toMatch(/^[a-zA-Z0-9_-]{1,80}$/);
  });

  it('não quebra com id vazio', () => {
    expect(handoffSlug('', at)).toBe('handoff-20260731-sessao');
  });
});

describe('parseHandoffResponse', () => {
  it('junta os blocos de texto', () => {
    expect(parseHandoffResponse({ content: [{ type: 'text', text: '## Contexto' }, { type: 'text', text: 'algo' }] }))
      .toBe('## Contexto\nalgo');
  });

  it('devolve null quando a resposta não tem texto', () => {
    expect(parseHandoffResponse({ content: [] })).toBeNull();
    expect(parseHandoffResponse({})).toBeNull();
    expect(parseHandoffResponse(null)).toBeNull();
  });
});

describe('handoffDescription', () => {
  it('usa a primeira fala do usuário', () => {
    const msgs = [
      { id: 'a', role: 'assistant', blocks: [] },
      { id: 'b', role: 'user', text: '  arruma  o\nreaper  ' },
    ] as unknown as Message[];
    expect(handoffDescription(msgs)).toBe('arruma o reaper');
  });

  it('cai num rótulo genérico quando não há fala do usuário', () => {
    expect(handoffDescription([])).toBe('sessão migrada');
  });
});

describe('headTail', () => {
  it('devolve o texto inteiro quando cabe', () => {
    expect(headTail('curto', 100)).toBe('curto');
  });

  it('preserva começo e fim, respeitando o teto', () => {
    const text = `${'a'.repeat(500)}${'b'.repeat(500)}${'c'.repeat(500)}`;
    const out = headTail(text, 100);
    expect(out.startsWith('a'.repeat(40))).toBe(true);
    expect(out.endsWith('c'.repeat(60))).toBe(true);
    expect(out).toContain('trecho do meio omitido');
  });
});

describe('handoffPrompt', () => {
  it('manda a transcrição depois da instrução', () => {
    const p = handoffPrompt('Você: oi');
    expect(p).toContain('## Tarefas principais');
    expect(p.endsWith('Você: oi')).toBe(true);
  });
});

describe('handoffFile', () => {
  it('gera frontmatter que o listContexts consegue ler', () => {
    const md = handoffFile('handoff-20260731-abc', 'trabalho\nno deck', '## Contexto\nx', at);
    expect(md.startsWith('---\nname: handoff-20260731-abc\n')).toBe(true);
    expect(md).toContain('description: trabalho no deck');
    expect(md).toContain('type: reference');
    expect(md).toContain('## Contexto');
  });
});

describe('distill — plano primeiro, API só como fallback', () => {
  beforeEach(() => {
    vi.mocked(runOnPlan).mockReset();
    vi.mocked(apiKey).mockReset();
    fetchMock.mockReset();
  });

  // O ponto da mudança: a conta de API está sem saldo e a destilação morria antes de
  // tentar. A cota do plano já paga o CLI que o Deck roda no harness.
  it('destila pelo plano sem tocar na API', async () => {
    vi.mocked(runOnPlan).mockResolvedValue({ status: 'done', resultText: '## Contexto\nok', inputTokens: 1, outputTokens: 1 });
    expect(await distill('transcript')).toBe('## Contexto\nok');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(apiKey).not.toHaveBeenCalled();
  });

  it('sem chave de API, o plano falhando devolve null em vez de estourar', async () => {
    vi.mocked(runOnPlan).mockResolvedValue({ status: 'error', inputTokens: 0, outputTokens: 0, error: 'x' });
    vi.mocked(apiKey).mockReturnValue(null);
    expect(await distill('transcript')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cai pra API quando o plano falha e existe chave', async () => {
    vi.mocked(runOnPlan).mockResolvedValue({ status: 'error', inputTokens: 0, outputTokens: 0, error: 'x' });
    vi.mocked(apiKey).mockReturnValue('sk-ant-x');
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'da api' }] }) });
    expect(await distill('transcript')).toBe('da api');
  });

  // Resposta vazia do plano é falha: gravar um contexto em branco arquivaria a sessão
  // e o usuário perderia o fio, que é justamente o que o handoff existe pra evitar.
  it('trata resposta vazia do plano como falha', async () => {
    vi.mocked(runOnPlan).mockResolvedValue({ status: 'done', resultText: '   ', inputTokens: 1, outputTokens: 1 });
    vi.mocked(apiKey).mockReturnValue(null);
    expect(await distill('transcript')).toBeNull();
  });
});
