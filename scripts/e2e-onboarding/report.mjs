import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function fmtDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`;
}

export function renderReport({ target, startedAt, steps, notes }) {
  const total = steps.reduce((n, s) => n + s.ms, 0);
  const failed = steps.filter((s) => s.status === 'fail').length;
  const lines = [
    '# Onboarding E2E report',
    '',
    `- Target: ${target}`,
    `- Started: ${startedAt}`,
    `- Total: ${fmtDuration(total)}`,
    `- Result: ${failed ? `FAIL (${failed} failed)` : 'PASS'}`,
    '',
    '| Step | Duration | Result | Screenshot |',
    '|---|---|---|---|',
    ...steps.map((s) => `| ${s.name} | ${fmtDuration(s.ms)} | ${s.status} | ${s.screenshot ? `![${s.name}](${s.screenshot})` : ''} |`),
  ];
  for (const s of steps.filter((x) => x.detail)) lines.push('', `## ${s.name}`, '', '```', s.detail, '```');
  if (notes?.length) lines.push('', '## Notes', '', ...notes.map((n) => `- ${n}`));
  return lines.join('\n') + '\n';
}

export function writeReport(dir, data) {
  const path = join(dir, 'report.md');
  writeFileSync(path, renderReport(data));
  return path;
}

export function createRecorder(dir) {
  const steps = [];
  async function step(name, fn) {
    const t0 = Date.now();
    const rec = { name, ms: 0, status: 'pass', screenshot: null, detail: '' };
    steps.push(rec);
    try {
      const r = await fn(rec);
      if (typeof r === 'string') rec.detail = r;
    } catch (e) {
      rec.status = 'fail';
      rec.detail = [rec.detail, String(e?.message ?? e)].filter(Boolean).join('\n');
    }
    rec.ms = Date.now() - t0;
    console.log(`[e2e] ${rec.status.toUpperCase()} ${name} (${fmtDuration(rec.ms)})`);
    return rec;
  }
  return { steps, step, dir };
}

export function tail(text, n = 25) {
  return text.trimEnd().split('\n').slice(-n).join('\n');
}
