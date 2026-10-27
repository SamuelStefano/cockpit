export const STATUS_PHRASES = ['Pensando…', 'Ponderando…', 'Juntando as peças…', 'Avançando…', 'Escrevendo…'] as const;
export const PHRASE_MS = 4_000;

export function phraseAt(elapsedMs: number): string {
  const i = Math.floor(Math.max(0, elapsedMs) / PHRASE_MS) % STATUS_PHRASES.length;
  return STATUS_PHRASES[i];
}
