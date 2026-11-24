import type { PrDiffFile } from '../../shared/prs';

export const FILE_PATCH_MAX = 200 * 1024;
export const TOTAL_PATCH_MAX = 1_500_000;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function mapStatus(v: unknown): PrDiffFile['change'] {
  if (v === 'added') return 'added';
  if (v === 'removed') return 'deleted';
  if (v === 'renamed') return 'renamed';
  return 'modified';
}

// Cuts at a line boundary so the viewer never renders half a line.
export function cutPatch(patch: string, max: number): { patch: string; cut: boolean } {
  if (Buffer.byteLength(patch) <= max) return { patch, cut: false };
  const head = Buffer.from(patch).subarray(0, max).toString('utf8');
  const nl = head.lastIndexOf('\n');
  return { patch: nl > 0 ? head.slice(0, nl) : head, cut: true };
}

// Pure: raw REST `pulls/{n}/files` pages in, bounded diff files out.
export function filesFromPages(pages: unknown[][], opts: { fileMax?: number; totalMax?: number } = {}): { files: PrDiffFile[]; truncated: boolean } {
  const fileMax = opts.fileMax ?? FILE_PATCH_MAX;
  const totalMax = opts.totalMax ?? TOTAL_PATCH_MAX;
  const files: PrDiffFile[] = [];
  let used = 0;
  let truncated = false;
  for (const raw of pages.flat()) {
    const o = obj(raw);
    const path = str(o.filename);
    if (!path) continue;
    const change = mapStatus(o.status);
    const file: PrDiffFile = { path, change, additions: num(o.additions), deletions: num(o.deletions) };
    const prev = str(o.previous_filename);
    if (change === 'renamed' && prev) file.previousPath = prev;
    const patch = typeof o.patch === 'string' ? o.patch : undefined;
    if (patch !== undefined) {
      if (used >= totalMax) truncated = true;
      else {
        const { patch: p, cut } = cutPatch(patch, Math.min(fileMax, totalMax - used));
        file.patch = p;
        used += Buffer.byteLength(p);
        if (cut) {
          // Only the per-file cap marks the file; running out of total budget cuts the diff itself.
          if (Buffer.byteLength(patch) > fileMax) file.patchTruncated = true; else { truncated = true; file.patchTruncated = true; }
        }
      }
    }
    files.push(file);
  }
  return { files, truncated };
}
