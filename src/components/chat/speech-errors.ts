// Códigos de erro da Web Speech API (SpeechRecognitionErrorEvent.error). Separa
// o que é fatal (não adianta reiniciar — precisa de ação do usuário) do que é
// transitório (pausa, rede instável) e dá uma mensagem em pt-BR pro usuário saber
// o que fazer no celular, em vez de o mic ligar e desligar sem explicação.

const FATAL = new Set(['not-allowed', 'service-not-allowed']);

export function isFatalSpeechError(code: string): boolean {
  return FATAL.has(code);
}

export function speechErrorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Permita o microfone nas configurações do navegador e tente de novo.';
    case 'audio-capture':
      return 'Microfone não encontrado.';
    case 'network':
      return 'Sem conexão para o reconhecimento de voz.';
    case 'no-speech':
      return 'Não ouvi nada. Toque no microfone e fale.';
    default:
      return 'Ditado por voz indisponível agora.';
  }
}
