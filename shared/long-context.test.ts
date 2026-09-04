import { describe, it, expect } from 'vitest';
import { isLongContextModel, stripLongContext } from './long-context';

describe('isLongContextModel', () => {
  it('reconhece as variantes que a conta expõe hoje', () => {
    for (const id of ['claude-opus-5[1m]', 'claude-sonnet-5[1m]', 'claude-fable-5-1[1m]', 'claude-opus-4-8[1m]']) {
      expect(isLongContextModel(id)).toBe(true);
    }
  });

  it('não pega o modelo normal nem o alias', () => {
    for (const id of ['claude-opus-5', 'opus', 'sonnet', 'haiku', 'claude-haiku-4-5-20251001']) {
      expect(isLongContextModel(id)).toBe(false);
    }
  });

  it('só casa no fim do id (não confunde com nome que contenha [1m] no meio)', () => {
    expect(isLongContextModel('claude-[1m]-opus')).toBe(false);
  });
});

describe('stripLongContext', () => {
  it('devolve o id base', () => {
    expect(stripLongContext('claude-opus-5[1m]')).toBe('claude-opus-5');
  });

  it('é idempotente e não mexe em id normal', () => {
    expect(stripLongContext(stripLongContext('claude-fable-5-1[1m]'))).toBe('claude-fable-5-1');
    expect(stripLongContext('opus')).toBe('opus');
  });
});
