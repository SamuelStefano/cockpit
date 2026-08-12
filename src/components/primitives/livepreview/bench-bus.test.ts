import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ClientMsg } from '../../../../shared/protocol';
import { setBenchSender, buildBench, benchDispatch, failAllBenchPending } from './bench-bus';

afterEach(() => setBenchSender(null));

function capture() {
  const sent: ClientMsg[] = [];
  setBenchSender((m) => { sent.push(m); return true; });
  return sent;
}

describe('bench-bus', () => {
  it('rejects when there is no socket', async () => {
    await expect(buildBench('r', 'code')).rejects.toThrow('sem conexão');
  });

  it('rejects when the frame could not be sent', async () => {
    setBenchSender(() => false);
    await expect(buildBench('r', 'code')).rejects.toThrow('sem conexão');
  });

  it('resolves the build that matches the id', async () => {
    const sent = capture();
    const p = buildBench('itera-player', 'code');
    const { buildId } = sent[0] as Extract<ClientMsg, { t: 'bench-build' }>;
    benchDispatch({ t: 'bench-bundle', buildId, js: 'JS', css: 'CSS', ms: 12 });
    await expect(p).resolves.toEqual({ js: 'JS', css: 'CSS', ms: 12 });
  });

  it('turns a server error into a rejection', async () => {
    const sent = capture();
    const p = buildBench('itera-player', 'code');
    const { buildId } = sent[0] as Extract<ClientMsg, { t: 'bench-build' }>;
    benchDispatch({ t: 'bench-error', buildId, error: 'fora do repo do bench' });
    await expect(p).rejects.toThrow('fora do repo do bench');
  });

  it('ignores a bundle for an unknown id instead of settling the wrong build', async () => {
    vi.useFakeTimers();
    const sent = capture();
    const p = buildBench('itera-player', 'code');
    const mine = (sent[0] as Extract<ClientMsg, { t: 'bench-build' }>).buildId;
    benchDispatch({ t: 'bench-bundle', buildId: 'outro', js: '', css: '', ms: 0 });
    benchDispatch({ t: 'bench-bundle', buildId: mine, js: 'MEU', css: '', ms: 1 });
    await expect(p).resolves.toMatchObject({ js: 'MEU' });
    vi.useRealTimers();
  });

  it('fails builds in flight when the socket drops', async () => {
    capture();
    const p = buildBench('itera-player', 'code');
    failAllBenchPending();
    await expect(p).rejects.toThrow('conexão caiu');
  });

  it('does not settle twice after a drop', async () => {
    const sent = capture();
    const p = buildBench('itera-player', 'code');
    const { buildId } = sent[0] as Extract<ClientMsg, { t: 'bench-build' }>;
    failAllBenchPending();
    await expect(p).rejects.toThrow('conexão caiu');
    // Resposta atrasada do servidor não pode ressuscitar um build já falho.
    expect(() => benchDispatch({ t: 'bench-bundle', buildId, js: '', css: '', ms: 0 })).not.toThrow();
  });

  it('gives up on a build the server never answers', async () => {
    vi.useFakeTimers();
    capture();
    const p = buildBench('itera-player', 'code');
    const assertion = expect(p).rejects.toThrow('expirou');
    await vi.advanceTimersByTimeAsync(131_000);
    await assertion;
    vi.useRealTimers();
  });
});
