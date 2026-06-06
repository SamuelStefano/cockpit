// Aviso de turno concluído quando a aba está em background (daily-driver: você
// dispara um prompt longo e troca de aba). Notification API + flash no título.
// Tudo best-effort: sem permissão / API ausente, vira no-op silencioso.

let baseTitle = typeof document !== 'undefined' ? document.title : 'cockpit';
let flashing = false;

// Título "base" da aba (sem o flash de done). Reflete atividade persistente:
// nº de sessões rodando/atualizadas, pra ver de relance com a aba em background.
export function setTitleBase(t: string): void {
  baseTitle = t;
  if (typeof document !== 'undefined' && !flashing) document.title = t;
}

export function requestNotifyPermission(): void {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

export function notifyTurnDone(sessionTitle: string, onActivate?: () => void): void {
  if (typeof document === 'undefined') return;
  if (document.visibilityState !== 'hidden') return; // só avisa fora da aba
  flashTitle();
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      const n = new Notification('Cockpit — resposta pronta', {
        body: sessionTitle || 'A sessão terminou de responder.',
        tag: 'cockpit-done',
      });
      // Clicar não só foca a janela: pula direto pra sessão que terminou.
      n.onclick = () => { window.focus(); onActivate?.(); n.close(); };
    } catch {
      /* best-effort */
    }
  }
}

function flashTitle(): void {
  if (flashing) return;
  flashing = true;
  document.title = '✦ ' + baseTitle;
  const restore = () => {
    if (document.visibilityState !== 'visible') return;
    document.title = baseTitle;
    flashing = false;
    document.removeEventListener('visibilitychange', restore);
  };
  document.addEventListener('visibilitychange', restore);
}
