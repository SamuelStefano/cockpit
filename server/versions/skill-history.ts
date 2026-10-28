import { readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { CONFIG } from '../config';
import { recordSnapshot } from './snapshots';

const SLUG_RE = /^[a-zA-Z0-9_-]{1,80}$/;

function skillFile(id: string): string | null {
  if (!SLUG_RE.test(id)) return null;
  const root = resolve(CONFIG.skillsDir);
  const full = resolve(join(root, id, 'SKILL.md'));
  return full.startsWith(root + sep) ? full : null;
}

export async function captureSkill(id: string, note?: string): Promise<void> {
  const full = skillFile(id);
  if (!full) return;
  try { await recordSnapshot('skill', id, await readFile(full, 'utf8'), note); } catch { /* not on disk: nothing to capture */ }
}

export async function writeSkillMd(id: string, content: string): Promise<boolean> {
  const full = skillFile(id);
  if (!full) return false;
  const tmp = `${full}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(tmp, content, 'utf8');
    await rename(tmp, full);
    return true;
  } catch { return false; }
}
