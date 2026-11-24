import { stat } from 'node:fs/promises';
import type { PlannerTask } from '../shared/planner';
import type { TeamMessage } from '../shared/team-messages';
import { plannerFile, readTasks } from './planner/store';
import { readTeamLogSince, teamLogFile } from './team-log';

// The push runs on every run start/end and board move, so it must not re-parse the
// whole log and board each time. The log is append-only (rolling over past 4MB), so
// only the bytes after the last offset are read; the board is re-read only when its
// file changed.
let logCache: { file: string; offset: number; items: TeamMessage[] } | null = null;

export async function readTeamLogCached(): Promise<TeamMessage[]> {
  const file = teamLogFile();
  if (!logCache || logCache.file !== file) logCache = { file, offset: 0, items: [] };
  const size = await stat(file).then((s) => s.size, () => 0);
  // A file shorter than the offset rolled over to `.1`: the current file starts anew.
  if (size < logCache.offset) logCache = { file, offset: 0, items: [] };
  const { items, offset } = await readTeamLogSince(logCache.offset);
  if (items.length) logCache.items = [...logCache.items, ...items];
  logCache.offset = offset;
  return logCache.items;
}

let tasksCache: { file: string; stamp: string; tasks: PlannerTask[] } | null = null;

export async function readTasksCached(): Promise<PlannerTask[]> {
  const file = plannerFile();
  const st = await stat(file).catch(() => null);
  const stamp = st ? `${st.mtimeMs}:${st.size}` : 'none';
  if (tasksCache && tasksCache.file === file && tasksCache.stamp === stamp) return tasksCache.tasks;
  const tasks = await readTasks();
  tasksCache = { file, stamp, tasks };
  return tasks;
}

export function _resetTeamStateCache(): void {
  logCache = null;
  tasksCache = null;
}
