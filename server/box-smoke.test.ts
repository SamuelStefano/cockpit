import { describe, it, expect } from 'vitest';
import { runSmoke, SMOKE_PROMPT, type Runner } from './box-smoke';
import type { RunOpts } from './engine/claude';

function fake(script: (o: RunOpts) => void): { runner: Runner; seen: RunOpts[] } {
  const seen: RunOpts[] = [];
  return { seen, runner: (o) => { seen.push(o); queueMicrotask(() => script(o)); return { kill: () => {} }; } };
}

describe('runSmoke', () => {
  it('runs the cheapest model in plan mode outside the chat workdir', async () => {
    const f = fake((o) => { o.onEvent({ type: 'result', subtype: 'success', is_error: false, result: 'ok', session_id: 's' }); o.onClose(); });
    let t = 0;
    const r = await runSmoke('student', f.runner, () => (t += 100));
    expect(r).toMatchObject({ state: 'done', ok: true, ms: 100 });
    expect(f.seen[0]).toMatchObject({ prompt: SMOKE_PROMPT, model: 'haiku', mode: 'plan', effort: 'low', role: 'student' });
    expect(f.seen[0].cwd).toMatch(/\.cockpit\/smoke$/);
  });

  it('reports the real error text with a hint', async () => {
    const f = fake((o) => { o.onError("claude saiu (1): error: unknown option '--effort'"); o.onClose(); });
    const r = await runSmoke('student', f.runner);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('unknown option');
    expect(r.hint).toMatch(/antigo demais/);
  });

  it('fails on an error result', async () => {
    const f = fake((o) => { o.onEvent({ type: 'result', subtype: 'error', is_error: true, result: 'OAuth token has expired', session_id: 's' }); o.onClose(); });
    const r = await runSmoke('admin', f.runner);
    expect(r).toMatchObject({ ok: false, error: 'OAuth token has expired' });
    expect(r.hint).toMatch(/login/);
  });

  it('fails when claude exits without an answer', async () => {
    const f = fake((o) => o.onClose());
    expect((await runSmoke('student', f.runner)).ok).toBe(false);
  });

  it('times out and kills a run that never closes', async () => {
    let killed = false;
    const runner: Runner = () => ({ kill: () => { killed = true; } });
    const r = await runSmoke('student', runner, Date.now, 20);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/timeout/);
    expect(killed).toBe(true);
  });

  it('reports a spawn that throws', async () => {
    const runner: Runner = () => { throw new Error('spawn claude ENOENT'); };
    const r = await runSmoke('student', runner);
    expect(r.hint).toMatch(/não acha o `claude`/);
  });
});
