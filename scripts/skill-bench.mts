// Regression bench for skills: runs saved cases against the working copy of a
// SKILL.md and an older git version, then prints a per-case diff.
//
//   npm run skill:bench -- <skill-dir> [--base HEAD~1] [--cases cases.json] [--live] [--judge] [--model haiku] [--max-calls 20] [--out report.md]
//
// Without --live it only validates the cases and prints the plan (zero model calls).
import { writeFile } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import { loadCases } from '../server/skill-bench/cases';
import { planCalls, runBench } from '../server/skill-bench/bench';
import { claudeRunner } from '../server/skill-bench/runner';
import { hasRegression, renderReport } from '../server/skill-bench/report';
import { readAtRef, readCurrent } from '../server/skill-bench/versions';

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string, d: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const dir = argv.find((a, i) => !a.startsWith('--') && (i === 0 || !argv[i - 1].startsWith('--')));
if (!dir) { console.error('usage: npm run skill:bench -- <skill-dir> [--base REF] [--live] [--judge]'); process.exit(2); }

const skillDir = resolve(dir);
const base = opt('base', 'HEAD~1');
const cases = await loadCases(resolve(opt('cases', join(skillDir, 'cases.json'))));
const judge = flag('judge');
const maxCalls = Number(opt('max-calls', '20'));

if (!flag('live')) {
  console.log(`${cases.length} cases valid; a live run needs ${planCalls(cases, judge)} model calls. Add --live to run.`);
  process.exit(0);
}

const runner = claudeRunner(opt('model', 'haiku'));
const report = await runBench({
  skill: basename(skillDir), baseRef: base,
  oldMd: await readAtRef(skillDir, base), newMd: await readCurrent(skillDir),
  cases, runner, judge: judge ? runner : undefined, maxCalls,
});
const md = renderReport(report);
console.log(md);
if (flag('out')) await writeFile(resolve(opt('out', 'report.md')), md);
process.exit(hasRegression(report) ? 1 : 0);
