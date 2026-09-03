import { describe, it, expect } from 'vitest';
import { collapseTurnNarration } from './turn-narration';
import type { ShownMessage } from './shown';
import type { Block, Message, ToolCall } from '../../data/types';

const user = (id: string): Message => ({ id, role: 'user', text: 'oi' });
const done = (id: string, blocks: Block[]): Message => ({ id, role: 'assistant', blocks, stats: { durationMs: 10 } });
const mid = (id: string, blocks: Block[]): Message => ({ id, role: 'assistant', blocks });
const text = (md: string): Block => ({ type: 'text', md });

describe('collapseTurnNarration', () => {
  it('junta o bastidor do turno numa caixa e deixa a resposta final solta', () => {
    const out = collapseTurnNarration([
      user('u1'),
      mid('a1', [text('vou abrir a PR')]),
      mid('a2', [text('lendo o README')]),
      done('a3', [text('pronto, PR aberta')]),
    ], true);
    expect(out.map((m) => m.id)).toEqual(['u1', 'notes:a1', 'a3']);
    expect(out[1].narration?.map((n) => n.md)).toEqual(['vou abrir a PR', 'lendo o README']);
  });

  it('acha o bastidor dentro de uma bolha só (turno ao vivo já concluído)', () => {
    const out = collapseTurnNarration([
      user('u1'),
      done('a1', [text('vou abrir a PR'), text('lendo o README'), text('pronto')]),
    ], true);
    expect(out.map((m) => m.id)).toEqual(['u1', 'notes:a1', 'a1']);
    expect(out[2].role === 'assistant' && out[2].blocks).toEqual([text('pronto')]);
  });

  it('colapsa o bastidor do turno EM VOO, deixando solto só o bloco que streama', () => {
    // O flood do chat em turno agêntico longo: as linhas de bastidor já concluídas
    // vão pra caixa na hora; o último bloco (o que está streamando) fica solto, então
    // a caixa nunca engole o texto que está sendo lido agora.
    const out = collapseTurnNarration([
      user('u1'),
      mid('a1', [text('vou abrir a PR')]),
      mid('a2', [text('lendo o README')]),
      mid('a3', [text('agora rodando os testes')]),
    ], true);
    expect(out.map((m) => m.id)).toEqual(['u1', 'notes:a1', 'a3']);
    expect(out[1].narration?.map((n) => n.md)).toEqual(['vou abrir a PR', 'lendo o README']);
    expect(out[2].role === 'assistant' && out[2].blocks).toEqual([text('agora rodando os testes')]);
  });

  it('turno em voo com prompt já enfileirado também colapsa o bastidor', () => {
    const out = collapseTurnNarration([
      user('u1'),
      mid('a1', [text('vou abrir a PR')]),
      mid('a2', [text('lendo o README')]),
      mid('a3', [text('agora rodando os testes')]),
      user('u2'),
    ], true);
    expect(out.map((m) => m.id)).toEqual(['u1', 'notes:a1', 'a3', 'u2']);
  });

  it('uma nota só continua inline', () => {
    const msgs = [user('u1'), mid('a1', [text('vou olhar')]), done('a2', [text('achei')])];
    expect(collapseTurnNarration(msgs, true)).toBe(msgs);
  });

  it('caixa por turno — a bolha com stats fecha o turno sem precisar de prompt', () => {
    const out = collapseTurnNarration([
      mid('a1', [text('nota 1')]),
      mid('a2', [text('nota 2')]),
      done('a3', [text('resposta 1')]),
      mid('a4', [text('nota 3')]),
      mid('a5', [text('nota 4')]),
      done('a6', [text('resposta 2')]),
    ], true);
    expect(out.map((m) => m.id)).toEqual(['notes:a1', 'a3', 'notes:a4', 'a6']);
  });

  it('divisor de compactação não fecha o turno; wakeup do /loop fecha', () => {
    const compact: Message = { id: 'c1', role: 'compact', trigger: 'auto' };
    const wake: Message = { id: 'w1', role: 'compact', kind: 'wakeup' };
    const withCompact = collapseTurnNarration([
      mid('a1', [text('nota 1')]),
      compact,
      mid('a2', [text('nota 2')]),
      done('a3', [text('resposta')]),
    ], true);
    expect(withCompact.map((m) => m.id)).toEqual(['notes:a1', 'c1', 'a3']);

    const withWake = collapseTurnNarration([
      mid('a1', [text('nota 1')]),
      mid('a2', [text('nota 2')]),
      done('a3', [text('resposta da iteração')]),
      wake,
      mid('a4', [text('nota 3')]),
      done('a5', [text('resposta')]),
    ], true);
    expect(withWake.map((m) => m.id)).toEqual(['notes:a1', 'a3', 'w1', 'a4', 'a5']);
  });

  it('texto estruturado ou longo é entrega, não bastidor', () => {
    const out = collapseTurnNarration([
      user('u1'),
      mid('a1', [text('vou levantar os números')]),
      mid('a2', [text('- item um\n- item dois')]),
      mid('a3', [text('e agora salvando')]),
      done('a4', [text('pronto')]),
    ], true);
    expect(out.map((m) => m.id)).toEqual(['u1', 'notes:a1', 'a2', 'a4']);
    expect(out[1].narration?.map((n) => n.md)).toEqual(['vou levantar os números', 'e agora salvando']);
  });

  it('bolha de erro, resposta-rápida e caixa de pergunta nunca viram nota', () => {
    const ask: ToolCall = { id: 't1', name: 'AskUserQuestion', label: 'AskUserQuestion', command: '', status: 'done', output: [] };
    const msgs: ShownMessage[] = [
      user('u1'),
      { id: 'a1', role: 'assistant', blocks: [text('nota 1')], error: true },
      { id: 'a2', role: 'assistant', blocks: [text('nota 2')], quick: true },
      { id: 'a3', role: 'assistant', blocks: [text('escolha uma opção'), { type: 'tool', tool: ask }] },
      { id: 'a4', role: 'assistant', blocks: [text('resposta')], stats: { durationMs: 10 } },
    ];
    expect(collapseTurnNarration(msgs, true)).toBe(msgs);
  });

  it('desligado devolve a lista intacta', () => {
    const msgs = [user('u1'), mid('a1', [text('n1')]), mid('a2', [text('n2')]), done('a3', [text('fim')])];
    expect(collapseTurnNarration(msgs, false)).toBe(msgs);
  });

  it('mantém referência estável entre recálculos', () => {
    const msgs = [user('u1'), mid('a1', [text('n1')]), mid('a2', [text('n2')]), done('a3', [text('fim')])];
    const a = collapseTurnNarration(msgs, true);
    const b = collapseTurnNarration(msgs, true);
    expect(b[1]).toBe(a[1]);
  });
});
