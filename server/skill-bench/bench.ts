import { evaluate } from './checks';
import { skillBody } from './versions';
import type { BenchReport, CaseDiff, CaseRun, Runner, SkillCase } from './types';

export function planCalls(cases: SkillCase[], judge: boolean): number {
  return cases.reduce((n, c) => n + 2 + (judge && c.checks.judge ? 2 : 0), 0);
}

async function runCase(c: SkillCase, system: string, runner: Runner, judge?: Runner): Promise<CaseRun> {
  try {
    const output = await runner(c.prompt, system);
    const results = await evaluate(output, c.checks, judge);
    return { output, results, pass: results.every((r) => r.pass) };
  } catch (e) {
    return { output: '', results: [], pass: false, error: (e as Error).message };
  }
}

export function verdictOf(o: CaseRun, n: CaseRun): CaseDiff['verdict'] {
  if (o.pass && n.pass) return 'same-pass';
  if (!o.pass && !n.pass) return 'same-fail';
  return o.pass ? 'regressed' : 'fixed';
}

export interface BenchInput {
  skill: string;
  baseRef: string;
  oldMd: string;
  newMd: string;
  cases: SkillCase[];
  runner: Runner;
  judge?: Runner;
  maxCalls: number;
}

export async function runBench(i: BenchInput): Promise<BenchReport> {
  const need = planCalls(i.cases, !!i.judge);
  if (need > i.maxCalls) throw new Error(`plan needs ${need} model calls, over the --max-calls cap of ${i.maxCalls}`);
  const oldSys = skillBody(i.oldMd);
  const newSys = skillBody(i.newMd);
  const diffs: CaseDiff[] = [];
  for (const c of i.cases) {
    const o = await runCase(c, oldSys, i.runner, i.judge);
    const n = await runCase(c, newSys, i.runner, i.judge);
    diffs.push({ id: c.id, old: o, new: n, verdict: verdictOf(o, n) });
  }
  return { skill: i.skill, baseRef: i.baseRef, cases: diffs, calls: need };
}
