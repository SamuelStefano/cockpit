import type { BotFile } from '../../../shared/protocol';

export type FileKind = 'image' | 'markdown' | 'text' | 'other';

const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i;
const MARKDOWN = /\.(md|markdown)$/i;
const TEXT = /\.(txt|csv|json|ya?ml|html?|tsx?|jsx?|py|css|log)$/i;

export function fileKind(path: string): FileKind {
  if (IMAGE.test(path)) return 'image';
  if (MARKDOWN.test(path)) return 'markdown';
  return TEXT.test(path) ? 'text' : 'other';
}

export interface FileGroup { label: string; items: BotFile[] }

const DAY = 86_400_000;

// Local day boundaries: "Hoje" is since midnight, "Esta semana" the six days before.
export function groupFilesByAge(items: BotFile[], now: number): FileGroup[] {
  const d = new Date(now);
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const week = today - 6 * DAY;
  const groups: FileGroup[] = [{ label: 'Hoje', items: [] }, { label: 'Esta semana', items: [] }, { label: 'Antes', items: [] }];
  for (const f of [...items].sort((a, b) => b.mtime - a.mtime)) groups[f.mtime >= today ? 0 : f.mtime >= week ? 1 : 2].items.push(f);
  return groups.filter((g) => g.items.length > 0);
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
