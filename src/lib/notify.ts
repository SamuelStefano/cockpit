// Aviso de turno concluído quando a aba está em background (daily-driver: você
// dispara um prompt longo e troca de aba). Notification API + flash no título.
// Tudo best-effort: sem permissão / API ausente, vira no-op silencioso.

let flashOriginal = '';
let flashing = false;

export function requestNotifyPermission(): void {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

export function notifyTurnDone(sessionTitle: string): void {
  if (typeof document === 'undefined') return;
  if (document.visibilityState !== 'hidden') return; // só avisa fora da aba
  flashTitle();
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      const n = new Notification('Cockpit — resposta pronta', {
        body: sessionTitle || 'A sessão terminou de responder.',
        tag: 'cockpit-done',
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch {
      /* best-effort */
    }
  }
}

function flashTitle(): void {
  if (flashing) return;
  flashing = true;
  flashOriginal = document.title;
  document.title = '● ' + flashOriginal;
  const restore = () => {
    if (document.visibilityState !== 'visible') return;
    document.title = flashOriginal;
    flashing = false;
    document.removeEventListener('visibilitychange', restore);
  };
  document.addEventListener('visibilitychange', restore);
}
