import { describe, expect, it } from 'vitest';
import { normalizeDictation as n } from './speech-normalize';

describe('vocabulary', () => {
  it.each(['xat', 'tchat', 'tchát', 'chét', 'chéti', 'chéte', 'xét', 'chati', 'chet'])('maps %s to chat', (v) => {
    expect(n(`abre o ${v} agora`)).toBe('abre o chat agora');
  });
  it('keeps sentence-initial capital and plural', () => {
    expect(n('Xat novo')).toBe('Chat novo');
    expect(n('os xats abertos')).toBe('os chats abertos');
  });
  it('maps other tech terms', () => {
    expect(n('abre o dek e o canban')).toBe('abre o deck e o kanban');
    expect(n('abre o pê érre')).toBe('abre o PR');
  });
  it('leaves normal Portuguese untouched', () => {
    for (const s of ['tomei um chá', 'a chave', 'chato', 'chateado', 'a chácara', 'o chat já existe', 'um chapéu', 'xadrez', 'cheta']) {
      expect(n(s)).toBe(s);
    }
  });
});

describe('elongation', () => {
  it('collapses 3+ repeated letters', () => {
    expect(n('praaa você')).toBe('pra você');
    expect(n('genteee')).toBe('gente');
    expect(n('eee vamo mandar bala')).toBe('e vamo mandar bala');
  });
  it('keeps legitimate doubles and www', () => {
    for (const s of ['cooperar', 'eles leem', 'vôo', 'www.site.com']) expect(n(s)).toBe(s);
  });
});

describe('fillers', () => {
  it('drops sentence-initial fillers with comma and capitalizes next word', () => {
    expect(n('Ééé, quero que leia')).toBe('Quero que leia');
    expect(n('Hããã, e é isso')).toBe('E é isso');
  });
  it('drops fillers mid-sentence', () => {
    expect(n('quero ééé, que leia')).toBe('quero que leia');
    expect(n('então. Hã, vamos')).toBe('então. Vamos');
    expect(n('foi ahn assim')).toBe('foi assim');
  });
  it('keeps é and e', () => {
    for (const s of ['é isso', 'ele é bom', 'pão e queijo', 'Hoje é dia']) expect(n(s)).toBe(s);
  });
  it('handles empty input', () => {
    expect(n('')).toBe('');
  });
});
