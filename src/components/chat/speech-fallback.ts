// Memória curta de "o engine de voz in-app falhou neste aparelho". Sem ela, cada
// abertura do Deck no iOS standalone/webview repetia 8s de mic pulsando em vão
// antes de cair no teclado. Expira pra uma falha transitória (rede, permissão
// negada uma vez) não aposentar o engine pra sempre.

const KEY = 'deck.speech.engine-failed-at';
export const ENGINE_FAILURE_TTL_MS = 24 * 60 * 60 * 1000;

export function rememberEngineFailure(now = Date.now()): void {
  try { localStorage.setItem(KEY, String(now)); } catch { /* storage bloqueado: só não lembra */ }
}

export function hasRecentEngineFailure(now = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(KEY));
    return at > 0 && now - at < ENGINE_FAILURE_TTL_MS;
  } catch {
    return false;
  }
}

export function forgetEngineFailure(): void {
  try { localStorage.removeItem(KEY); } catch { /* idem */ }
}
