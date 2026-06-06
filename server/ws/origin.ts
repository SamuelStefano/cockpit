// CSWSH (cross-site WebSocket hijacking): um browser em outra origem pode abrir
// um ws:// pro backend e herdar a sessão. Hoje só o loopback nos protege. Esta
// allowlist é opt-in: sem COCKPIT_ALLOWED_ORIGINS não filtra nada (preserva o
// front no Vercel). Quando Samuel expor o app, basta setar as origens válidas.
// Cliente sem header Origin (node/curl, não-browser) não é vetor de CSWSH → passa.
const ALLOWED_ORIGINS = (process.env.COCKPIT_ALLOWED_ORIGINS ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean);

export function originAllowed(origin?: string): boolean {
  if (ALLOWED_ORIGINS.length === 0) return true;
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(origin);
}
