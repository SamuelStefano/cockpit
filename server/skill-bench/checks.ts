import type { CaseChecks, CheckResult, Runner } from './types';

export function judgePrompt(rubric: string, output: string): string {
  return `You grade an assistant answer against a rubric. Reply with exactly PASS or FAIL on the first line, then one short reason.\n\nRubric:\n${rubric}\n\nAnswer:\n${output}`;
}

export function parseJudge(reply: string): boolean {
  return /^\s*PASS\b/i.test(reply);
}

export async function evaluate(output: string, checks: CaseChecks, judge?: Runner): Promise<CheckResult[]> {
  const hay = output.toLowerCase();
  const results: CheckResult[] = [];
  for (const s of checks.mustContain ?? []) results.push({ kind: 'mustContain', detail: s, pass: hay.includes(s.toLowerCase()) });
  for (const s of checks.mustNotContain ?? []) results.push({ kind: 'mustNotContain', detail: s, pass: !hay.includes(s.toLowerCase()) });
  if (checks.judge) {
    if (!judge) results.push({ kind: 'judge', detail: `${checks.judge} (skipped: pass --judge)`, pass: true });
    else results.push({ kind: 'judge', detail: checks.judge, pass: parseJudge(await judge(judgePrompt(checks.judge, output), null)) });
  }
  return results;
}
