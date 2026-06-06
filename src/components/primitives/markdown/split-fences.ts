// Separa regiões de código cercado (```), que podem conter linhas em branco,
// ANTES do split por parágrafo. Sem isto, fence com linha vazia se partia em
// vários blocos e o código vinha como texto cru com os ``` à mostra.
export function splitFences(md: string): Array<{ t: 'code'; lang: string; code: string } | { t: 'prose'; text: string }> {
  const lines = md.split('\n');
  const segs: Array<{ t: 'code'; lang: string; code: string } | { t: 'prose'; text: string }> = [];
  let prose: string[] = [];
  const flush = () => { if (prose.join('\n').trim()) segs.push({ t: 'prose', text: prose.join('\n') }); prose = []; };
  let i = 0;
  while (i < lines.length) {
    const open = /^```([a-zA-Z0-9_+#.-]*)$/.exec(lines[i].trim());
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
