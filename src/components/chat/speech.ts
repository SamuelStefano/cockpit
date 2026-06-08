// Junta o texto ditado ao que já estava no composer quando a gravação começou.
// O ditado entra DEPOIS do que o usuário tinha digitado, com um espaço só de
// separação (sem duplicar espaço/quebra que já exista no fim do base).
export function joinTranscript(base: string, transcript: string): string {
  const spoken = transcript.trim();
  if (!spoken) return base;
  const head = base.replace(/\s+$/, '');
  if (!head) return spoken;
  return `${head} ${spoken}`;
}

// Idioma do reconhecimento. Samuel dita em pt-BR; fica num só lugar pra trocar.
export const SPEECH_LANG = 'pt-BR';
