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
