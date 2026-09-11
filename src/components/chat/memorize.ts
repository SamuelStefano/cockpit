const MAX_CHARS = 4000;

// Seeds the composer instead of sending: the user reviews what becomes durable memory.
export function memorizePrompt(text: string): string {
  const trimmed = text.trim();
  const clipped = trimmed.length > MAX_CHARS ? trimmed.slice(0, MAX_CHARS).trimEnd() + '…' : trimmed;
  const quoted = clipped.split('\n').map((l) => '> ' + l).join('\n');
  return [
    'Transforme o trecho abaixo em memória durável.',
    'Guarde só o que muda como você age em conversas futuras: regra, decisão ou fato não óbvio.',
    'Antes de salvar, procure em memory/ um arquivo que já cubra o assunto e atualize em vez de duplicar.',
    'Se não houver nada durável, diga isso e não salve.',
    '',
    quoted,
  ].join('\n');
}
