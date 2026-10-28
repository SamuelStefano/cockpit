import { THIEF_DROP } from './skits';

export interface Box { left: number; top: number; width: number; height: number }

export interface LetterPick {
  range: Range;
  char: string;
  // Glyph box relative to the stage layer.
  box: Box;
  font: { family: string; size: string; weight: string; color: string; style: string };
}

const SKIP = 'pre, code, button, a, input, textarea, select, [contenteditable], svg, [aria-hidden="true"], .bit-stage';
const WORD = /[A-Za-zÀ-ÖØ-öø-ÿ]{4,}/g;

// A glyph is usable when Bit fits beside and below it, and there is headroom for
// the letter to ride over its head, all inside the visible stage.
export function fitsStage(box: Box, stageW: number, stageH: number, size: number): boolean {
  const feetY = box.top + box.height + size * THIEF_DROP;
  return box.top >= size * 0.7 && feetY <= stageH - 4 && box.left >= size && box.left + box.width <= stageW - size && box.width > 2;
}

// Thin glyphs (i, l, t…) vanish in Bit's hands; take the chunkiest one nearest the
// middle of the word.
const THIN = /[iljtfrIJ.,]/;
export function chunkyIndex(word: string): number {
  const mid = Math.floor(word.length / 2);
  for (let d = 0; d < word.length; d++) {
    for (const i of [mid - d, mid + d]) if (i >= 0 && i < word.length && !THIN.test(word[i])) return i;
  }
  return mid;
}

export function findLetter(root: HTMLElement, layer: HTMLElement, size: number, rnd = Math.random): LetterPick | null {
  const L = layer.getBoundingClientRect();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const found: { node: Text; index: number; box: Box }[] = [];
  for (let n = walker.nextNode() as Text | null; n && found.length < 80; n = walker.nextNode() as Text | null) {
    const parent = n.parentElement;
    if (!parent || parent.closest(SKIP)) continue;
    for (const m of n.data.matchAll(WORD)) {
      const index = (m.index ?? 0) + chunkyIndex(m[0]);
      const r = document.createRange();
      r.setStart(n, index);
      r.setEnd(n, index + 1);
      const b = r.getBoundingClientRect();
      const box = { left: b.left - L.left, top: b.top - L.top, width: b.width, height: b.height };
      if (fitsStage(box, L.width, L.height, size)) found.push({ node: n, index, box });
    }
  }
  if (found.length === 0) return null;
  const pick = found[Math.floor(rnd() * found.length) % found.length];
  const range = document.createRange();
  range.setStart(pick.node, pick.index);
  range.setEnd(pick.node, pick.index + 1);
  const cs = getComputedStyle(pick.node.parentElement!);
  return {
    range,
    char: pick.node.data[pick.index],
    box: pick.box,
    font: { family: cs.fontFamily, size: cs.fontSize, weight: cs.fontWeight, color: cs.color, style: cs.fontStyle },
  };
}

// Hides the real glyph while Bit holds its copy, through the CSS Custom Highlight
// API: the message DOM and text are never touched. Without the API the original
// just stays visible, which is harmless.
const HIGHLIGHT = 'bit-stolen';

export function hideGlyph(range: Range): () => void {
  const reg = (globalThis.CSS as unknown as { highlights?: Map<string, unknown> } | undefined)?.highlights;
  const H = (globalThis as unknown as { Highlight?: new (r: Range) => unknown }).Highlight;
  if (!reg || !H) return () => {};
  reg.set(HIGHLIGHT, new H(range));
  return () => { reg.delete(HIGHLIGHT); };
}
