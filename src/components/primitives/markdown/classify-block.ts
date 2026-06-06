// Classifica um bloco de markdown (já separado por linha em branco) no seu tipo
// estrutural, sem tocar em JSX. A ordem dos testes É a precedência: hr → heading
// → tabela → blockquote → lista → parágrafo. Puro e testável — o render só mapeia
// cada Block pro seu nó React.
export type ListItem = { depth: number; text: string; done: boolean | null };

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

export function parseListItems(lines: string[]): ListItem[] {
  return lines.map((l) => {
    const text = l.replace(/^\s*(?:\d+\.|[-*])\s+/, '');
    const task = /^\[([ xX])\]\s+(.*)$/.exec(text);
    return {
      depth: Math.min(4, Math.floor(/^\s*/.exec(l)![0].length / 2)),
      text: task ? task[2] : text,
      done: task ? task[1].toLowerCase() === 'x' : null,
    };
  });
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

  const isOrdered = lines.every((l) => /^\s*\d+\.\s+/.test(l));
  const isUnordered = lines.every((l) => /^\s*[-*]\s+/.test(l));
  if ((isOrdered || isUnordered) && lines.length > 0 && lines[0].trim() !== '') {
    const items = parseListItems(lines);
    return {
      kind: 'list',
      ordered: isOrdered,
      task: isUnordered && items.some((it) => it.done !== null),
      items,
    };
  }

  return { kind: 'paragraph', lines };
}
