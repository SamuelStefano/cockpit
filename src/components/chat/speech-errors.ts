// Códigos de erro da Web Speech API (SpeechRecognitionErrorEvent.error). Separa
// o que é fatal (não adianta reiniciar — precisa de ação do usuário) do que é
// transitório (pausa, rede instável) e dá uma mensagem em pt-BR pro usuário saber
// o que fazer no celular, em vez de o mic ligar e desligar sem explicação.

const FATAL = new Set(['not-allowed', 'service-not-allowed']);

export function isFatalSpeechError(code: string): boolean {
  return FATAL.has(code);
}

// Nada foi captado mesmo com o engine "ligado". No iPhone o caso mais comum é o
// app aberto pela tela inicial (standalone): a Web Speech API só capta no Safari,
// não em webview/PWA — start() não falha, mas onresult nunca chega.
export function noCaptureMessage(iosStandalone: boolean): string {
  return iosStandalone
    ? 'No iPhone o ditado só funciona no Safari, não no app aberto pela tela inicial.'
    : 'Não captei áudio. Toque no microfone e fale; no iPhone, aguarde ~2s antes de falar.';
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
