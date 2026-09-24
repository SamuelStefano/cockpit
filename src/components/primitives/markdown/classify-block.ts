// Classifica um bloco de markdown (já separado por linha em branco) no seu tipo
// estrutural, sem tocar em JSX. A ordem dos testes É a precedência: hr → heading
// → tabela → blockquote → lista → parágrafo. Puro e testável — o render só mapeia
// cada Block pro seu nó React.
// `num` = the number written in the source for an ordered item ("3." → 3), so a
// bullet nested inside a numbered list doesn't shift the numbering after it.
export type ListItem = { depth: number; text: string; done: boolean | null; num?: number };

export type Block =
  | { kind: 'hr' }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'table'; header: string[]; rows: string[][] }
  | { kind: 'blockquote'; lines: string[] }
  | { kind: 'list'; ordered: boolean; task: boolean; items: ListItem[] }
  | { kind: 'paragraph'; lines: string[] };

export function parseTableCells(line: string): string[] {
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
}

const MARKER = /^\s*(?:\d+\.|[-*])\s+/;
const isMarker = (l: string): boolean => MARKER.test(l);
// An indented line under an item without its own marker: the item's text wrapped.
const isContinuation = (l: string): boolean => /^\s{2,}\S/.test(l);
// CommonMark: a list may interrupt a paragraph only with a bullet or "1.", so a
// wrapped sentence that happens to start with "2026. " stays prose.
const startsList = (l: string): boolean => /^\s*(?:[-*]|1\.)\s+/.test(l);
const HEADING_LINE = /^#{1,6}\s+\S/;
const TABLE_SEP = /^[\s|:-]+$/;
const isTableStart = (l: string, next: string | undefined): boolean =>
  l.includes('|') && next !== undefined && next.includes('-') && TABLE_SEP.test(next.trim());

export function parseListItems(lines: string[]): ListItem[] {
  const items: ListItem[] = [];
  for (const l of lines) {
    if (!isMarker(l) && items.length) {
      const prev = items[items.length - 1];
      prev.text = `${prev.text} ${l.trim()}`;
      continue;
    }
    const num = /^\s*(\d+)\./.exec(l);
    const text = l.replace(MARKER, '');
    const task = /^\[([ xX])\]\s+(.*)$/.exec(text);
    items.push({
      depth: Math.min(4, Math.floor(/^\s*/.exec(l)![0].length / 2)),
      text: task ? task[2] : text,
      done: task ? task[1].toLowerCase() === 'x' : null,
      ...(num ? { num: Number(num[1]) } : {}),
    });
  }
  return items;
}

// A block (text between blank lines) often packs several structures with no
// blank line between them — the way the model writes: "Achados:\n- a\n- b",
// "## Título\ntexto", "Resumo:\n| a | b |\n|---|---|". Split it into runs so each
// one classifies on its own; a block that is a single structure comes back whole.
export function splitBlock(block: string): string[] {
  const lines = block.split('\n');
  if (lines.length < 2 || lines[0].trimStart().startsWith('>')) return [block];
  const runs: string[][] = [];
  let cur: string[] = [];
  let kind: 'para' | 'list' | 'table' = 'para';
  const flush = () => { if (cur.length) runs.push(cur); cur = []; };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (kind === 'table' && l.includes('|')) { cur.push(l); continue; }
    if (kind === 'list' && (isMarker(l) || isContinuation(l))) { cur.push(l); continue; }
    if (HEADING_LINE.test(l)) { flush(); runs.push([l]); kind = 'para'; continue; }
    if (isTableStart(l, lines[i + 1])) { flush(); cur.push(l); kind = 'table'; continue; }
    if (cur.length === 0 ? isMarker(l) : kind !== 'list' && startsList(l)) { flush(); cur.push(l); kind = 'list'; continue; }
    if (kind !== 'para') { flush(); kind = 'para'; }
    cur.push(l);
  }
  flush();
  const out = runs.map((r) => r.join('\n')).filter((r) => r.trim() !== '');
  return out.length > 1 ? out : [block];
}

// The prose blocks of a markdown text, in render order. The renderer and the
// DocViewer outline both walk this, so a heading's slug is the same in both.
export function proseBlockStrings(md: string): string[] {
  return md.split('\n\n').flatMap(splitBlock);
}

export function classifyBlock(block: string): Block {
  const lines = block.split('\n');

  if (lines.length === 1 && /^(?:-{3,}|\*{3,}|_{3,})$/.test(block.trim())) {
    return { kind: 'hr' };
  }

  const heading = /^(#{1,6})\s+(.*)$/.exec(block.trim());
  if (heading && lines.length === 1) {
    return { kind: 'heading', level: heading[1].length, text: heading[2] };
  }

  if (
    lines.length >= 2 &&
    lines[0].includes('|') &&
    lines[1].includes('-') &&
    /^[\s|:-]+$/.test(lines[1].trim())
  ) {
    return {
      kind: 'table',
      header: parseTableCells(lines[0]),
      rows: lines.slice(2).map(parseTableCells),
    };
  }

  if (block.trim().startsWith('>')) {
    const inner = lines.map((l) => l.replace(/^\s*>\s?/, '')).join('\n');
    return { kind: 'blockquote', lines: inner.split('\n') };
  }

  // Mixed markers are one list ("1. a\n   - sub\n2. b"): its kind comes from the
  // first item; wrapped lines (indented, no marker) belong to the item above.
  if (isMarker(lines[0]) && lines.every((l) => isMarker(l) || isContinuation(l))) {
    const ordered = /^\s*\d+\./.test(lines[0]);
    const items = parseListItems(lines);
    return {
      kind: 'list',
      ordered,
      task: !ordered && items.some((it) => it.done !== null),
      items,
    };
  }

  return { kind: 'paragraph', lines };
}
