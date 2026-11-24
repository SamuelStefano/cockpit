export interface OpsConfig {
  supabaseUrl: string;
  anonKey: string;
  serviceKey: string;
  adminIds: Set<string>;
  sessionSecret: string;
  telegram: { token: string; chatId: string } | null;
  publicUrl: string;
  publicOrigin: string;
  // Extra https origins the login form may be posted from (e.g. an sslip.io fallback host).
  allowedOrigins: string[];
  relayStatusUrl: string;
  relayStatusToken: string | null;
  port: number;
  cursorFile: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function loadConfig(env: Record<string, string | undefined>): OpsConfig {
  const missing: string[] = [];
  const need = (k: string): string => {
    const v = env[k]?.trim();
    if (!v) missing.push(k);
    return v ?? '';
  };
  const supabaseUrl = need('SUPABASE_URL').replace(/\/$/, '');
  const anonKey = need('SUPABASE_ANON_KEY');
  const serviceKey = need('SUPABASE_SERVICE_ROLE_KEY');
  const adminRaw = need('ADMIN_USER_IDS');
  const sessionSecret = need('SESSION_SECRET');
  const publicUrl = need('PUBLIC_URL').replace(/\/$/, '');
  if (missing.length) throw new Error(`missing env: ${missing.join(', ')}`);

  const adminIds = new Set(adminRaw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
  if (!adminIds.size || [...adminIds].some((id) => !UUID.test(id))) throw new Error('ADMIN_USER_IDS must be a comma list of user uuids');
  if (sessionSecret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  const pub = new URL(publicUrl);
  const local = pub.hostname === 'localhost' || pub.hostname === '127.0.0.1';
  if (pub.protocol !== 'https:' && !local) throw new Error('PUBLIC_URL must be https');
  if (!supabaseUrl.startsWith('https://')) throw new Error('SUPABASE_URL must be https');
  const extra = (env.EXTRA_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean).map((s) => new URL(s));
  if (extra.some((u) => u.protocol !== 'https:' || u.pathname !== '/')) throw new Error('EXTRA_ORIGINS must be bare https origins');

  const tgToken = env.TELEGRAM_BOT_TOKEN?.trim();
  const tgChat = env.TELEGRAM_CHAT_ID?.trim();
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error('PORT is invalid');

  return {
    supabaseUrl,
    anonKey,
    serviceKey,
    adminIds,
    sessionSecret,
    telegram: tgToken && tgChat ? { token: tgToken, chatId: tgChat } : null,
    publicUrl,
    publicOrigin: pub.origin,
    allowedOrigins: [pub.origin, ...extra.map((u) => u.origin)],
    relayStatusUrl: env.RELAY_STATUS_URL?.trim() || 'https://deck-relay.devfellowship.com/status',
    relayStatusToken: env.RELAY_STATUS_TOKEN?.trim() || null,
    port,
    cursorFile: env.CURSOR_FILE?.trim() || '/data/alert-cursor.json',
  };
}
