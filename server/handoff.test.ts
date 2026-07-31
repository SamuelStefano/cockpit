import { describe, it, expect } from 'vitest';
import { handoffSlug, handoffPrompt, parseHandoffResponse, handoffDescription, handoffFile } from './handoff';
import type { Message } from '../shared/protocol';

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
