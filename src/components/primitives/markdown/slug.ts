// Slug estável de heading, compartilhado entre o render (proseBlocks põe no id do
// <hN>) e o índice do DocViewer (links de navegação). Os dois PRECISAM derivar o
// mesmo slug do mesmo texto, senão o clique no índice não acha a âncora.
export function headingSlug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[`*~_[\]()]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'section'
  );
}

// Two "### Exemplo" in one doc got the same id: the outline's second entry scrolled
// to the first and the scroll-spy lit both. Repeats get -2, -3… in document order;
// render and outline each pass one fresh map per document so they agree.
export function uniqueHeadingSlug(text: string, seen: Map<string, number>): string {
  const base = headingSlug(text);
  const n = (seen.get(base) ?? 0) + 1;
  seen.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}
