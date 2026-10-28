import { createRelay } from './index';
import { supabaseStore } from './store';
import { readRevision } from './obs';

// Entry do relay T3 (DR-023/024). Lê config do ENV, monta o store Supabase e sobe
// o servidor em LOOPBACK — o Caddy faz o TLS em :443 e encaminha pra cá. Roda numa
// VPS isolada (sem sudo/docker), nunca na box do DFL prod (C-COLOCATION).

function required(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`[relay] faltando env ${name}`); process.exit(1); }
  return v;
}

const supabaseUrl = required('SUPABASE_URL').replace(/\/$/, '');
const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
const rootEmails = process.env.COCKPIT_ROOT_EMAILS ?? '';
const port = Number(process.env.RELAY_PORT ?? '8800');
const host = process.env.RELAY_HOST ?? '127.0.0.1';

function positiveInt(raw: string | undefined): number | undefined {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

if (!process.env.DECK_ALLOWED_ORIGINS?.trim()) console.warn('[relay] DECK_ALLOWED_ORIGINS unset: any origin accepted');

const { server, shutdown } = createRelay({
  iss: `${supabaseUrl}/auth/v1`,
  jwksUrl: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
  rootEmails,
  rootUserIds: process.env.COCKPIT_ROOT_USER_IDS,
  allowedOrigins: process.env.DECK_ALLOWED_ORIGINS,
  maxSocketsPerIp: positiveInt(process.env.DECK_MAX_SOCKETS_PER_IP),
  maxTabsPerAccount: positiveInt(process.env.DECK_MAX_TABS_PER_ACCOUNT),
  maxBoxesPerAccount: positiveInt(process.env.DECK_MAX_BOXES_PER_ACCOUNT),
  store: supabaseStore({ url: supabaseUrl, serviceKey }),
  statusToken: process.env.DECK_STATUS_TOKEN,
  opsToken: process.env.DECK_OPS_TOKEN,
  logSalt: process.env.DECK_LOG_SALT,
  revision: readRevision(process.env.DECK_RELAY_REVISION),
});

server.listen(port, host, () => {
  console.log(`[relay] ouvindo em ${host}:${port} (Caddy faz o TLS público)`);
});

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    shutdown(() => process.exit(0));
    // Backstop: never outlive a stop by more than a few seconds.
    setTimeout(() => process.exit(0), 5_000).unref();
  });
}
