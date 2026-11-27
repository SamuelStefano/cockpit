import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export function skillBody(md: string): string {
  return md.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
}

export async function readCurrent(skillDir: string): Promise<string> {
  return readFile(join(skillDir, 'SKILL.md'), 'utf8');
}

export async function readAtRef(skillDir: string, ref: string): Promise<string> {
  if (!/^[\w./~^@{}-]{1,100}$/.test(ref) || ref.startsWith('-')) throw new Error(`invalid git ref "${ref}"`);
  const dir = resolve(skillDir);
  const { stdout: top } = await run('git', ['-C', dir, 'rev-parse', '--show-toplevel']);
  const rel = relative(top.trim(), join(dir, 'SKILL.md')).split('\\').join('/');
  const { stdout } = await run('git', ['-C', dir, 'show', `${ref}:${rel}`], { maxBuffer: 8 * 1024 * 1024 });
  return stdout;
}
