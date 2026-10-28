const RECOMMENDED_RE = /\s*\((?:recomendad[ao]|recommended)\)\s*$/i;

export function parseRecommended(label: string): { label: string; recommended: boolean } {
  const clean = label.replace(RECOMMENDED_RE, '');
  return { label: clean, recommended: clean !== label };
}
