// Parser of the orchestrator's marathon file (e.g. ~/pontos-maratona-20260923.md):
//   ## Épico N — Title — X pt
//   - Task title — refs — points
// Refs are optional (`- Task — points`). Dependency-free: the CLI imports it with
// native Node type stripping.

export interface ParsedDraftTask { title: string; points: number; refs: string[] }
export interface ParsedDraftEpic { title: string; declaredPoints: number | null; tasks: ParsedDraftTask[] }
export interface ParsedDrafts { epics: ParsedDraftEpic[]; warnings: string[] }

const SEP = /\s+[—–]\s+/;
const HEADER = /^##\s+(.+)$/;
const EPIC_PREFIX = /^[ÉE]pico\s+\d+\s*$/i;
const PTS = /^~?\s*(\d+(?:[.,]\d+)?)\s*(?:pts?|pontos?)?$/i;

function num(s: string): number | null {
  const m = PTS.exec(s.trim());
  return m ? Number(m[1].replace(',', '.')) : null;
}

// "LS#580, LS#581" → 2 refs; "campaigns#84, #102" and "learn#377/#378" inherit the
// repo prefix so every badge is self-explanatory out of context.
export function splitRefs(raw: string): string[] {
  const out: string[] = [];
  let prefix = '';
  for (const part of raw.split(/\s*,\s*|\/(?=#)/)) {
    const p = part.trim();
    if (!p) continue;
    const m = /^([\w.-]+)#/.exec(p);
    if (m) prefix = m[1];
    out.push(p.startsWith('#') && prefix ? `${prefix}${p}` : p);
  }
  return out;
}

function parseHeader(text: string): { title: string; declared: number | null } {
  const parts = text.split(SEP);
  if (parts.length > 1 && EPIC_PREFIX.test(parts[0])) parts.shift();
  const last = parts.length > 1 ? num(parts[parts.length - 1]) : null;
  if (last !== null) parts.pop();
  return { title: parts.join(' — ').trim(), declared: last };
}

function parseTask(text: string): ParsedDraftTask | null {
  const parts = text.split(SEP);
  if (parts.length < 2) return null;
  const pts = num(parts[parts.length - 1]);
  if (pts === null) return null;
  const title = parts[0].trim();
  const refs = parts.length > 2 ? splitRefs(parts.slice(1, -1).join(', ')) : [];
  return title ? { title, points: pts, refs } : null;
}

export function parseDraftsMarkdown(md: string): ParsedDrafts {
  const epics: ParsedDraftEpic[] = [];
  const warnings: string[] = [];
  let cur: ParsedDraftEpic | null = null;
  for (const line of md.split(/\r?\n/)) {
    const h = HEADER.exec(line.trim());
    if (h) {
      const { title, declared } = parseHeader(h[1]);
      cur = { title, declaredPoints: declared, tasks: [] };
      epics.push(cur);
      continue;
    }
    const item = /^\s*[-*]\s+(.+)$/.exec(line);
    if (!item || !cur) continue;
    const task = parseTask(item[1]);
    if (task) cur.tasks.push(task);
    else warnings.push(`linha ignorada (sem pontos no fim): ${item[1].slice(0, 80)}`);
  }
  for (const e of epics) {
    const sum = Math.round(e.tasks.reduce((s, t) => s + t.points, 0) * 100) / 100;
    if (e.declaredPoints !== null && e.declaredPoints !== sum) {
      warnings.push(`"${e.title}": cabeçalho diz ${e.declaredPoints} pt, tasks somam ${sum} pt`);
    }
  }
  return { epics, warnings };
}
