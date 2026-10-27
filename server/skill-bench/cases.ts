import { readFile } from 'node:fs/promises';
import type { SkillCase } from './types';

function strings(v: unknown, where: string): string[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !x)) throw new Error(`${where} must be an array of non-empty strings`);
  return v as string[];
}

export function parseCases(raw: string): SkillCase[] {
  let data: unknown;
  try { data = JSON.parse(raw); } catch (e) { throw new Error(`cases file is not valid JSON: ${(e as Error).message}`); }
  const list = Array.isArray(data) ? data : (data as { cases?: unknown })?.cases;
  if (!Array.isArray(list) || list.length === 0) throw new Error('cases file needs a non-empty "cases" array');
  const seen = new Set<string>();
  return list.map((c, i) => {
    const o = c as Record<string, unknown>;
    const id = typeof o?.id === 'string' ? o.id : '';
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error(`case #${i + 1}: id must match [a-zA-Z0-9_-]{1,80}`);
    if (seen.has(id)) throw new Error(`duplicate case id "${id}"`);
    seen.add(id);
    if (typeof o.prompt !== 'string' || !o.prompt.trim()) throw new Error(`case "${id}": prompt is required`);
    const ch = (o.checks ?? {}) as Record<string, unknown>;
    const mustContain = strings(ch.mustContain, `case "${id}" checks.mustContain`);
    const mustNotContain = strings(ch.mustNotContain, `case "${id}" checks.mustNotContain`);
    const judge = ch.judge === undefined ? undefined : String(ch.judge);
    if (!mustContain?.length && !mustNotContain?.length && !judge) throw new Error(`case "${id}": needs at least one check`);
    return { id, prompt: o.prompt, checks: { mustContain, mustNotContain, judge } };
  });
}

export async function loadCases(path: string): Promise<SkillCase[]> {
  return parseCases(await readFile(path, 'utf8'));
}
