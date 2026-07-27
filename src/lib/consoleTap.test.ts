import { describe, it, expect, vi } from 'vitest';
import { tapConsole } from './consoleTap';

describe('tapConsole', () => {
  it('espelha o log sem engolir o console real', () => {
    const seen: Array<[string, string]> = [];
    const orig = vi.spyOn(console, 'log').mockImplementation(() => {});
    const restore = tapConsole((level, text) => seen.push([level, text]));

    console.log('oi', 42);
    expect(seen).toEqual([['log', 'oi 42']]);
    expect(orig).toHaveBeenCalledWith('oi', 42);

    restore();
    orig.mockRestore();
  });

  it('rebaixa debug pra log e mantém os outros níveis', () => {
    const seen: string[] = [];
    const spies = (['info', 'warn', 'error', 'debug'] as const).map((k) => vi.spyOn(console, k).mockImplementation(() => {}));
    const restore = tapConsole((level) => seen.push(level));

    console.info('a');
    console.warn('b');
    console.error('c');
    console.debug('d');
    expect(seen).toEqual(['info', 'warn', 'error', 'log']);

    restore();
    spies.forEach((s) => s.mockRestore());
  });

  it('serializa objeto, erro e ciclo sem lançar', () => {
    const seen: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const restore = tapConsole((_l, text) => seen.push(text));

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    console.log({ a: 1 });
    console.log(new Error('falhou'));
    console.log(cyclic);
    expect(seen[0]).toBe('{"a":1}');
    expect(seen[1]).toBe('falhou');
    expect(seen[2]).toContain('object');

    restore();
    spy.mockRestore();
  });

  it('não arranca o grampo de quem entrou depois', () => {
    const quiet = vi.spyOn(console, 'log').mockImplementation(() => {});
    const restoreA = tapConsole(() => {});
    const seenB: string[] = [];
    const restoreB = tapConsole((_l, text) => seenB.push(text));
    const wrapperB = console.log;

    restoreA();
    expect(console.log).toBe(wrapperB);
    console.log('ainda escuto');
    expect(seenB).toEqual(['ainda escuto']);

    restoreB();
    quiet.mockRestore();
  });

  it('devolve o console original no restore', () => {
    const before = console.log;
    const restore = tapConsole(() => {});
    expect(console.log).not.toBe(before);
    restore();
    expect(console.log).toBe(before);
  });
});
