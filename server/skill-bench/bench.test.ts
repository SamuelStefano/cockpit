import { describe, expect, it } from 'vitest';
import { parseCases } from './cases';
import { evaluate, parseJudge } from './checks';
import { planCalls, runBench, verdictOf } from './bench';
import { hasRegression, renderReport } from './report';
import { claudeArgs } from './runner';
import { skillBody } from './versions';
import type { Runner } from './types';

const raw = JSON.stringify({ cases: [
  { id: 'a', prompt: 'say hi', checks: { mustContain: ['HELLO'], mustNotContain: ['bye'] } },
  { id: 'b', prompt: 'rubric', checks: { judge: 'is polite' } },
] });

describe('parseCases', () => {
  it('parses cases and accepts a bare array', () => {
    expect(parseCases(raw)).toHaveLength(2);
    expect(parseCases(JSON.stringify(JSON.parse(raw).cases))).toHaveLength(2);
  });
  it('rejects bad input', () => {
    expect(() => parseCases('{')).toThrow(/valid JSON/);
    expect(() => parseCases('{"cases":[]}')).toThrow(/non-empty/);
    expect(() => parseCases('[{"id":"../x","prompt":"p","checks":{"judge":"j"}}]')).toThrow(/id/);
    expect(() => parseCases('[{"id":"x","prompt":"p"}]')).toThrow(/at least one check/);
    expect(() => parseCases('[{"id":"x","prompt":"p","checks":{"mustContain":[""]}}]')).toThrow(/non-empty strings/);
    const dup = '{"id":"x","prompt":"p","checks":{"judge":"j"}}';
    expect(() => parseCases(`[${dup},${dup}]`)).toThrow(/duplicate/);
  });
});

describe('evaluate', () => {
  it('checks substrings case-insensitively', async () => {
    const r = await evaluate('Hello there', { mustContain: ['hello'], mustNotContain: ['bye'] });
    expect(r.every((x) => x.pass)).toBe(true);
    const bad = await evaluate('bye', { mustContain: ['hello'], mustNotContain: ['bye'] });
    expect(bad.map((x) => x.pass)).toEqual([false, false]);
  });
  it('calls the judge only when provided', async () => {
    const judge: Runner = async () => 'FAIL\nrude';
    expect((await evaluate('x', { judge: 'polite' }, judge))[0].pass).toBe(false);
    expect((await evaluate('x', { judge: 'polite' }))[0].detail).toMatch(/skipped/);
    expect(parseJudge('pass\nok')).toBe(true);
    expect(parseJudge('no')).toBe(false);
  });
});

describe('runBench', () => {
  const cases = parseCases(raw).slice(0, 1);
  const runner: Runner = async (_p, sys) => (sys === 'new body' ? 'bye' : 'HELLO');
  const base = { skill: 's', baseRef: 'HEAD~1', oldMd: '---\nname: s\n---\nold body', newMd: 'new body', cases, runner, maxCalls: 10 };

  it('flags a regression old pass → new fail', async () => {
    const r = await runBench({ ...base, oldMd: 'old body' });
    expect(r.cases[0].verdict).toBe('regressed');
    expect(hasRegression(r)).toBe(true);
    expect(renderReport(r)).toContain('| a | pass | FAIL | regressed |');
  });
  it('enforces the call cap', async () => {
    await expect(runBench({ ...base, maxCalls: 1 })).rejects.toThrow(/max-calls/);
  });
  it('records runner errors as failures', async () => {
    const r = await runBench({ ...base, runner: async () => { throw new Error('boom'); } });
    expect(r.cases[0].old.error).toBe('boom');
    expect(r.cases[0].verdict).toBe('same-fail');
  });
  it('plans calls and classifies verdicts', () => {
    expect(planCalls(parseCases(raw), true)).toBe(6);
    expect(planCalls(parseCases(raw), false)).toBe(4);
    const ok = { output: '', results: [], pass: true };
    expect(verdictOf({ ...ok, pass: false }, ok)).toBe('fixed');
  });
});

describe('helpers', () => {
  it('strips frontmatter', () => expect(skillBody('---\nname: x\n---\nbody\n')).toBe('body'));
  it('builds a tool-less claude invocation', () => {
    const a = claudeArgs('p', 'sys', 'haiku');
    expect(a).toEqual(expect.arrayContaining(['--model', 'haiku', '--tools', '', '--append-system-prompt', 'sys']));
    expect(claudeArgs('p', null, 'haiku')).not.toContain('--append-system-prompt');
  });
});
