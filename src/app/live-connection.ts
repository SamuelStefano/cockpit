import type { ConnState } from '../components/primitives';

// Acima disto, uma aba que ficou escondida (mobile suspende o timer/socket) voltou
// com estado durável velho o bastante pra valer reconciliar mesmo se o WS ainda
// se diz "connected" — o socket costuma estar morto em silêncio.
export const STALE_HIDDEN_MS = 8000;

export function shouldReconnect(hiddenMs: number, wsState: ConnState): boolean {
  return wsState !== 'connected' || hiddenMs > STALE_HIDDEN_MS;
}
