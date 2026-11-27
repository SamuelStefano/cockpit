import type { BenchReport, CaseRun } from './types';

const mark = (r: CaseRun) => (r.error ? 'ERROR' : r.pass ? 'pass' : 'FAIL');

export function hasRegression(r: BenchReport): boolean {
  return r.cases.some((c) => c.verdict === 'regressed');
}

export function renderReport(r: BenchReport): string {
  const count = (v: string) => r.cases.filter((c) => c.verdict === v).length;
  const lines = [
    `# Skill bench: ${r.skill}`,
    '',
    `Old = \`${r.baseRef}\`, new = working copy. ${r.cases.length} cases, ${r.calls} model calls.`,
    `Regressed ${count('regressed')}, fixed ${count('fixed')}, still failing ${count('same-fail')}, unchanged passing ${count('same-pass')}.`,
    '',
    '| case | old | new | verdict |',
    '|---|---|---|---|',
    ...r.cases.map((c) => `| ${c.id} | ${mark(c.old)} | ${mark(c.new)} | ${c.verdict} |`),
  ];
  const detail = r.cases.filter((c) => c.verdict !== 'same-pass');
  for (const c of detail) {
    lines.push('', `## ${c.id} (${c.verdict})`);
    for (const [label, run] of [['old', c.old], ['new', c.new]] as const) {
      if (run.error) { lines.push(`- ${label}: error: ${run.error}`); continue; }
      const failed = run.results.filter((x) => !x.pass).map((x) => `${x.kind} "${x.detail}"`);
      lines.push(`- ${label}: ${failed.length ? `failed ${failed.join('; ')}` : 'all checks passed'}`);
    }
  }
  return `${lines.join('\n')}\n`;
}
