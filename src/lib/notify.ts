// Aviso de turno concluído quando a aba está em background (daily-driver: você
// dispara um prompt longo e troca de aba). Notification API + flash no título.
// Tudo best-effort: sem permissão / API ausente, vira no-op silencioso.

import { loadPref } from './persist';
import { NOTIFY_SOUND_KEY, NOTIFY_SOUND_DEFAULT } from './prefs';

let baseTitle = typeof document !== 'undefined' ? document.title : 'Deck';
let flashing = false;

// Ícones do manifest: sem eles o Android/Chrome desenha o favicon genérico do
// site na notificação.
const ICON = '/icon-192.png';
const BADGE = '/favicon-32.png';

type BadgeNavigator = {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
  vibrate?: (pattern: number | number[]) => boolean;
};

function nav(): BadgeNavigator | undefined {
  return typeof navigator === 'undefined' ? undefined : (navigator as unknown as BadgeNavigator);
}

// Contador no ícone do app: só existe em PWA instalado (é o único lugar onde o
// aviso sobrevive à aba fechada). Fora disso a API não existe e isto é no-op.
export function setBadge(count: number): void {
  const n = nav();
  if (!n) return;
  try {
    const p = count > 0 ? n.setAppBadge?.(count) : n.clearAppBadge?.();
    p?.catch(() => {});
  } catch {
    /* best-effort */
  }
}

// Vibrar só com ponteiro grosso: em desktop a API existe em alguns Chrome e o
// "aviso" seria invisível, além de gastar gesto que o navegador conta contra nós.
function vibrate(pattern: number[]): void {
  const n = nav();
  if (!n || typeof n.vibrate !== 'function') return;
  if (typeof matchMedia !== 'function' || !matchMedia('(pointer: coarse)').matches) return;
  try {
    n.vibrate(pattern);
  } catch {
    /* best-effort */
  }
}

// Beep sintetizado no AudioContext em vez de arquivo: um mp3 de meio segundo
// pesaria mais que este módulo inteiro e precisaria de preload pra tocar a tempo.
function beep(freq: number): void {
  if (!loadPref(NOTIFY_SOUND_KEY, NOTIFY_SOUND_DEFAULT)) return;
  const Ctx = typeof window === 'undefined'
    ? undefined
    : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctx) return;
  try {
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.onended = () => { void ctx.close(); };
    osc.start(t);
    osc.stop(t + 0.2);
  } catch {
    /* best-effort */
  }
}

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
  vibrate([30]);
  beep(660);
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      const n = new Notification('Deck — resposta pronta', {
        body: sessionTitle || 'A sessão terminou de responder.',
        tag: 'cockpit-done',
        icon: ICON,
        badge: BADGE,
      });
      // Clicar não só foca a janela: pula direto pra sessão que terminou.
      n.onclick = () => { window.focus(); onActivate?.(); n.close(); };
    } catch {
      /* best-effort */
    }
  }
}

// Espelha notifyTurnDone pro caso de falha: rodar a noite toda e voltar sem
// saber que o turno quebrou (overload, exit não-zero, claude fora do PATH) é o
// pior cenário — aqui o erro avisa igual ao sucesso, fora da aba.
export function notifyTurnError(sessionTitle: string, message: string, onActivate?: () => void): void {
  if (typeof document === 'undefined') return;
  if (document.visibilityState !== 'hidden') return;
  flashTitle();
  vibrate([60, 40, 60]);
  beep(220);
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      const n = new Notification('Deck — turno falhou', {
        body: (sessionTitle ? `${sessionTitle} — ` : '') + (message || 'A sessão terminou com erro.'),
        tag: 'cockpit-error',
        icon: ICON,
        badge: BADGE,
      });
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
