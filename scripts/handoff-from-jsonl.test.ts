import { describe, it, expect } from 'vitest';
import { transcriptTail, factsFrom, buildPrompt, capAtLine, parseApiResponse, HANDOFF_INSTR } from './handoff-from-jsonl.mjs';
import type { Message, ToolCall } from '../shared/protocol';

function user(text: string): Message { return { id: text, role: 'user', text }; }
function tool(t: Partial<ToolCall>): Message {
  return {
    id: 'a', role: 'assistant',
    blocks: [{ type: 'tool', tool: { id: 't', name: 'Edit', label: '', command: '', status: 'done', output: [], ...t } }],
  };
}

describe('transcriptTail', () => {
  it('mantém a cauda, não o começo', () => {
    const msgs = [user('primeiro'), user('ultimo')];
    expect(transcriptTail(msgs, 20)).toContain('ultimo');
    expect(transcriptTail(msgs, 20)).not.toContain('primeiro');
  });

  it('achata assistant lendo text e code', () => {
    const m: Message = { id: 'a', role: 'assistant', blocks: [{ type: 'text', md: 'oi' }] };
    expect(transcriptTail([m])).toBe('Claude: oi');
  });
});

describe('factsFrom', () => {
  it('coleta arquivos de Edit/Write por caminho absoluto', () => {
    const r = factsFrom([tool({ name: 'Write', label: '/home/samuel/x.ts' }), tool({ name: 'Edit', label: '/home/samuel/y.ts' })]);
    expect(r.files).toEqual(['/home/samuel/x.ts', '/home/samuel/y.ts']);
  });

  it('ignora caminho relativo (ruído de label) e tool que não escreve', () => {
    const r = factsFrom([tool({ name: 'Edit', label: 'src/x.ts' }), tool({ name: 'Read', label: '/home/samuel/z.ts' })]);
    expect(r.files).toEqual([]);
  });

  it('extrai PR de #NNN e de url pull/NNN, sem duplicar', () => {
    const r = factsFrom([
      tool({ name: 'Bash', command: 'gh pr view 519', label: 'PR #519' }),
      tool({ name: 'Bash', command: 'https://github.com/x/y/pull/519', label: '' }),
      tool({ name: 'Bash', command: '', label: '#522' }),
    ]);
    expect(r.prs).toEqual(['#519', '#522']);
  });
});

describe('capAtLine', () => {
  it('não mexe no que cabe', () => {
    expect(capAtLine('curto', 100)).toBe('curto');
  });

  it('corta no fim de linha, não no meio da palavra', () => {
    const t = 'linha um\nlinha dois\nlinha tres com palavra longa';
    expect(capAtLine(t, 25)).toMatch(/^linha um\nlinha dois\n\n_\(handoff truncado/);
  });

  it('corta no caractere quando não há quebra útil', () => {
    expect(capAtLine('a'.repeat(50), 10)).toMatch(/^a{10}\n\n_\(handoff truncado/);
  });
});

describe('buildPrompt', () => {
  it('marca com — quando não há fato apurado', () => {
    const p = buildPrompt('Você: oi', { files: [], prs: [] });
    expect(p).toContain(HANDOFF_INSTR);
    expect(p).toMatch(/Arquivos tocados[^\n]*\n—/);
  });

  it('injeta os fatos apurados antes do transcript', () => {
    const p = buildPrompt('Você: marcador-do-transcript', { files: ['/a.ts'], prs: ['#1'] });
    expect(p.indexOf('/a.ts')).toBeLessThan(p.indexOf('marcador-do-transcript'));
  });
});

// Resposta cortada no teto de saída era gravada como handoff completo — e esse
// texto vira prefixo de prompt da próxima sessão.
describe('parseApiResponse', () => {
  it('recusa resposta cortada no max_tokens', () => {
    expect(parseApiResponse({ stop_reason: 'max_tokens', content: [{ type: 'text', text: 'metade do han' }] })).toBeNull();
  });

  it('aceita resposta que terminou sozinha', () => {
    expect(parseApiResponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'completo' }] })).toBe('completo');
  });

  it('junta os blocos de texto e ignora o resto', () => {
    expect(parseApiResponse({ content: [{ type: 'text', text: 'a' }, { type: 'thinking' }, { type: 'text', text: 'b' }] })).toBe('ab');
  });

  it('devolve null em corpo malformado ou vazio', () => {
    expect(parseApiResponse({})).toBeNull();
    expect(parseApiResponse(null)).toBeNull();
    expect(parseApiResponse({ content: [{ type: 'text', text: '  ' }] })).toBeNull();
  });
});
