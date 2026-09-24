// Separa regiões de código cercado (```), que podem conter linhas em branco,
// ANTES do split por parágrafo. Sem isto, fence com linha vazia se partia em
// vários blocos e o código vinha como texto cru com os ``` à mostra.
export function splitFences(md: string): Array<{ t: 'code'; lang: string; code: string } | { t: 'prose'; text: string }> {
  const lines = md.split('\n');
  const segs: Array<{ t: 'code'; lang: string; code: string } | { t: 'prose'; text: string }> = [];
  let prose: string[] = [];
  // Blank lines at the edges of a prose run are dropped: the blank line after a
  // closing fence (or before an opening one) stuck to the next block, so
  // "```…```\n\n## Title" rendered "## Title" as literal text, and a table right
  // before a fence got an empty last row.
  const flush = () => {
    let a = 0;
    let b = prose.length;
    while (a < b && !prose[a].trim()) a++;
    while (b > a && !prose[b - 1].trim()) b--;
    if (b > a) segs.push({ t: 'prose', text: prose.slice(a, b).join('\n') });
    prose = [];
  };
  let i = 0;
  while (i < lines.length) {
    // `:` está no conjunto por causa do bench (```bench:<slug>).
    const open = /^```([a-zA-Z0-9_+#.:-]*)$/.exec(lines[i].trim());
    if (open) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '```') { code.push(lines[i]); i++; }
      if (i < lines.length) i++; // pula a fence de fechamento
      segs.push({ t: 'code', lang: open[1], code: code.join('\n') });
    } else {
      prose.push(lines[i]);
      i++;
    }
  }
  flush();
  return segs;
}
