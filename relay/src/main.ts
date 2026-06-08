import { createRelay } from './index';
import { supabaseStore } from './store';

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

const { server } = createRelay({
  iss: `${supabaseUrl}/auth/v1`,
  jwksUrl: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
  rootEmails,
  store: supabaseStore({ url: supabaseUrl, serviceKey }),
});

server.listen(port, host, () => {
  console.log(`[relay] ouvindo em ${host}:${port} (Caddy faz o TLS público)`);
});

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => { server.close(() => process.exit(0)); });
}
