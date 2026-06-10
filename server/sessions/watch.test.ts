import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sessionIdFromFile, createWatchHandler } from './watch';

describe('sessionIdFromFile', () => {
  it('extrai o id de um jsonl de sessão', () => {
    expect(sessionIdFromFile('9c8612aa-a083-43e2-b163-db814bd397da.jsonl')).toBe('9c8612aa-a083-43e2-b163-db814bd397da');
  });

  it('rejeita arquivos que não são sessão', () => {
    expect(sessionIdFromFile('notes.md')).toBeNull();
    expect(sessionIdFromFile('9c8612aa-a083-43e2-b163-db814bd397da.jsonl.tmp')).toBeNull();
    expect(sessionIdFromFile('UPPER-CASE-0000-0000-000000000000.jsonl')).toBeNull();
    expect(sessionIdFromFile(null)).toBeNull();
    expect(sessionIdFromFile(undefined)).toBeNull();
    expect(sessionIdFromFile(Buffer.from('x'))).toBeNull();
  });
});

describe('createWatchHandler', () => {
  const FILE = '9c8612aa-a083-43e2-b163-db814bd397da.jsonl';
  const OTHER = '11111111-2222-4333-8444-555555555555.jsonl';

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  function make(hasClients = () => true) {
    const touch = vi.fn();
    const list = vi.fn();
    const handler = createWatchHandler({ hasClients, touch, list, touchMs: 100, listMs: 300 });
    return { handler, touch, list };
  }

  it('debounce trailing: rajada de escritas vira um touch só', () => {
    const { handler, touch } = make();
    handler(FILE);
    vi.advanceTimersByTime(50);
    handler(FILE);
    vi.advanceTimersByTime(50);
    expect(touch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(touch).toHaveBeenCalledTimes(1);
    expect(touch).toHaveBeenCalledWith('9c8612aa-a083-43e2-b163-db814bd397da');
  });

  it('sessões distintas têm debounce independente', () => {
    const { handler, touch } = make();
    handler(FILE);
    handler(OTHER);
    vi.advanceTimersByTime(100);
    expect(touch).toHaveBeenCalledTimes(2);
  });

  it('lista no máximo 1x por janela', () => {
    const { handler, list } = make();
    handler(FILE);
    handler(OTHER);
    handler(FILE);
    vi.advanceTimersByTime(300);
    expect(list).toHaveBeenCalledTimes(1);
    handler(FILE);
    vi.advanceTimersByTime(300);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('sem clientes: ignora tudo', () => {
    const { handler, touch, list } = make(() => false);
    handler(FILE);
    vi.advanceTimersByTime(500);
    expect(touch).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it('arquivo não-sessão não agenda nada', () => {
    const { handler, touch, list } = make();
    handler('memory');
    vi.advanceTimersByTime(500);
    expect(touch).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });
});
