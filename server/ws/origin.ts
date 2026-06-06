// CSWSH (cross-site WebSocket hijacking): um browser noutra origem pode abrir um
// ws:// pro backend e dirigir o agente / abrir um PTY. Loopback NÃO protege — o
// próprio browser da vítima é o pivô. Por isso o default NÃO é mais allow-all
// (DR-010, red-team CRIT-1): sem COCKPIT_ALLOWED_ORIGINS só passam origens locais
// (localhost/127.0.0.1/[::1]) — o que cobre o vite dev e o front servido em
// 127.0.0.1 sem quebrar nada. Quando Samuel expuser via Tailscale/Vercel, seta as
// origens válidas; localhost continua sempre liberado (é ele mesmo).
// Cliente sem header Origin (node/curl, não-browser) não é vetor de CSWSH → passa
// (loopback-only por ora; o gate de auth #6/#107 fecha isso quando o app sair do loopback).
const ALLOWED_ORIGINS = (process.env.COCKPIT_ALLOWED_ORIGINS ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean);

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export function originAllowed(origin?: string): boolean {
  if (!origin) return true;
  if (LOCAL_ORIGIN.test(origin)) return true;
  return ALLOWED_ORIGINS.includes(origin);
}
