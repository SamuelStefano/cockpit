import { describe, expect, it, vi } from 'vitest';
import { canBecomeRule } from './decisions';
import { levelOf, rankOf, scoreShift, Sim } from './sim';

function run(s: Sim, secs: number, onTick?: () => void) {
  for (let i = 0; i < secs * 10 && !s.ended; i++) { s.step(0.1); onTick?.(); }
}
const answerAll = (s: Sim) => { for (const a of s.sortedAlerts()) s.choose(a.id, 0); };

describe('Sim', () => {
  it('is deterministic for a seed', () => {
    const a = new Sim(), b = new Sim();
    run(a, 30); run(b, 30);
    expect(a.feedLog.map((f) => f.msg)).toEqual(b.feedLog.map((f) => f.msg));
  });

  it('plays a whole shift to the end when every alert is answered', () => {
    const s = new Sim();
    run(s, 900, () => answerAll(s));
    expect(s.ended).toBe(true);
    expect(s.end?.prs).toBeGreaterThan(5);
    expect(s.crates.every((c) => c.done)).toBe(true);
  });

  it('keeps a migration behind the gate until a person approves', () => {
    const s = new Sim();
    run(s, 300, () => { for (const a of s.sortedAlerts()) if (a.type !== 'migration') s.choose(a.id, 0); });
    const gate = s.alerts.find((a) => a.type === 'migration');
    expect(gate?.risk).toBe('UNSAFE');
    expect(s.crates.find((c) => c.job.needsGate)?.stage).toBeLessThan(3);
    s.choose(gate!.id, 0);
    run(s, 12);
    expect(s.crates.find((c) => c.job.needsGate)?.stage).toBeGreaterThanOrEqual(3);
  });

  it('offers a rule after the same pick twice and lets the rule answer next time', () => {
    const onRules = vi.fn();
    const s = new Sim({ onRules });
    const a = s.wingAgents('team')[0], b = s.wingAgents('team')[1];
    for (const who of [a, b]) { who.silent = true; s.raise('silent', { a: who }, who); s.choose(s.alerts[0].id, 0); }
    expect(s.ruleOffer?.type).toBe('silent');
    s.acceptRule();
    expect(onRules).toHaveBeenCalled();
    const c = s.wingAgents('team')[2];
    c.silent = true;
    s.raise('silent', { a: c }, c);
    expect(s.alerts).toHaveLength(0);
    expect(c.silent).toBe(false);
    expect(s.autoHandled).toBe(1);
  });

  it('never turns unsafe or public decisions into rules', () => {
    expect(canBecomeRule('migration', 'UNSAFE')).toBe(false);
    expect(canBecomeRule('post')).toBe(false);
    expect(canBecomeRule('silent')).toBe(true);
  });

  it('misses a post that nobody approves', () => {
    const s = new Sim();
    run(s, 90);
    expect(s.flags.postMissed).toBe(true);
    expect(s.alerts.some((a) => a.type === 'post')).toBe(false);
  });

  it('breaks production after merging over a finding, and rolls the crate back', () => {
    const s = new Sim();
    run(s, 900, () => { for (const a of s.sortedAlerts()) s.choose(a.id, a.type === 'finding' ? 1 : 0); });
    expect(s.regressions).toBe(1);
    expect(s.feedLog.some((f) => f.msg.includes('went back'))).toBe(true);
  });

  it('summarizes a step away', () => {
    const s = new Sim();
    run(s, 5);
    s.stepAway();
    expect(s.since?.waiting).toBe(s.alerts.length);
    expect(s.t).toBeGreaterThan(120);
  });
});

describe('scoring', () => {
  it('prices peak pressure, misses and regressions', () => {
    expect(scoreShift(0, false, 0, 0)).toBe(100);
    expect(scoreShift(50, true, 1, 0)).toBe(40);
    expect(rankOf(85)).toBe('S');
    expect(rankOf(10)).toBe('C');
    expect(levelOf(450)).toBe(3);
  });
});
