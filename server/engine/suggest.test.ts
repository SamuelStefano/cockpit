import { describe, it, expect } from 'vitest';
import { parseSuggestions } from './suggest';

describe('parseSuggestions', () => {
  it('parseia um array JSON limpo', () => {
    expect(parseSuggestions('["Rodar os testes de novo", "Abrir PR da correção"]'))
      .toEqual(['Rodar os testes de novo', 'Abrir PR da correção']);
  });

  it('extrai o array mesmo embrulhado em fence/texto', () => {
    const raw = 'Aqui estão:\n```json\n["Verificar o deploy", "Checar logs do rails"]\n```';
    expect(parseSuggestions(raw)).toEqual(['Verificar o deploy', 'Checar logs do rails']);
  });

  it('limita a 3 itens', () => {
    const raw = JSON.stringify(['Primeira sugestão', 'Segunda sugestão', 'Terceira sugestão', 'Quarta sugestão']);
    expect(parseSuggestions(raw)).toHaveLength(3);
  });

  it('descarta itens curtos demais e não-strings', () => {
    expect(parseSuggestions('["ok", 42, "Uma sugestão de verdade aqui"]')).toEqual(['Uma sugestão de verdade aqui']);
  });

  it('trunca itens longos com reticências', () => {
    const long = 'x'.repeat(120);
    const [only] = parseSuggestions(JSON.stringify([long]));
    expect(only.length).toBeLessThanOrEqual(80);
    expect(only.endsWith('…')).toBe(true);
  });

  it('devolve [] em vazio, lixo e não-array', () => {
    expect(parseSuggestions('')).toEqual([]);
    expect(parseSuggestions('sem json nenhum')).toEqual([]);
    expect(parseSuggestions('{"a":1}')).toEqual([]);
  });
});
