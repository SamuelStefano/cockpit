import { describe, it, expect, vi } from 'vitest';
import { evaluate, createHealthCache, withTimeout, type HealthProbes } from './box-health';
import { REQUIRED_CLI_FLAGS, BOT_CLI_FLAGS, type BoxHealth } from '../shared/box-health';

function probes(over: Partial<HealthProbes> = {}): HealthProbes {
  return {
    agent: async () => ({ head: 'abc1234', boot: 'abc1234', behind: 0 }),
    cli: async () => ({ path: '/usr/bin/claude', version: '2.1.0', help: [...REQUIRED_CLI_FLAGS, ...BOT_CLI_FLAGS].join(' ') }),
    auth: () => ({ ready: true, held: false }),
    node: () => 'v22.1.0',
    pty: async () => ({ ok: true, error: '' }),
    disk: async () => 50 * 1024 ** 3,
    devices: () => 1,
    selfUpdate: () => ({ result: 'current', reason: '' }),
    ...over,
  };
}

describe('evaluate', () => {
  it('reports every check, all ok on a healthy box', async () => {
    const h = await evaluate(probes(), 42);
    expect(h.at).toBe(42);
    expect(h.items.map((i) => i.id)).toEqual(['claude-cli', 'claude-auth', 'agent', 'self-update', 'node', 'pty', 'disk', 'devices']);
    expect(h.items.every((i) => i.level === 'ok')).toBe(true);
  });

  it('turns a hung probe into an unknown result instead of hanging the report', async () => {
    const h = await evaluate(probes({ cli: () => new Promise(() => {}) }), 1, 20);
    expect(h.items.find((i) => i.id === 'claude-cli')?.level).toBe('error');
  });

  it('turns a throwing probe into its fallback', async () => {
    const h = await evaluate(probes({ disk: async () => { throw new Error('statfs'); } }), 1, 50);
    expect(h.items.find((i) => i.id === 'disk')?.level).toBe('warn');
  });

  it('flags the outdated CLI that broke every prompt', async () => {
    const h = await evaluate(probes({ cli: async () => ({ path: '/usr/bin/claude', version: '1.0.0', help: '--permission-mode' }) }));
    expect(h.items[0]).toMatchObject({ id: 'claude-cli', level: 'error' });
  });
});

describe('withTimeout', () => {
  it('resolves with the value when fast', async () => {
    expect(await withTimeout(Promise.resolve(1), 50, 0)).toBe(1);
  });
  it('falls back on rejection', async () => {
    expect(await withTimeout(Promise.reject(new Error('x')), 50, 7)).toBe(7);
  });
});

describe('createHealthCache', () => {
  const report = (at: number): BoxHealth => ({ at, items: [] });

  it('serves the cached report within the ttl and collects again after', async () => {
    let t = 1000;
    const collect = vi.fn(async () => report(t));
    const c = createHealthCache(collect, 100, () => t);
    await c.get();
    t = 1050;
    await c.get();
    expect(collect).toHaveBeenCalledTimes(1);
    t = 1200;
    await c.get();
    expect(collect).toHaveBeenCalledTimes(2);
  });

  it('shares one collection between concurrent callers', async () => {
    let release: (h: BoxHealth) => void = () => {};
    const collect = vi.fn(() => new Promise<BoxHealth>((r) => { release = r; }));
    const c = createHealthCache(collect, 100);
    const a = c.refresh();
    const b = c.refresh();
    release(report(1));
    expect(await a).toBe(await b);
    expect(collect).toHaveBeenCalledTimes(1);
    expect(c.peek()?.at).toBe(1);
  });
});
