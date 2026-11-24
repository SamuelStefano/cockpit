import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, mustRun } from './exec.mjs';

const API = 'https://api.hetzner.cloud/v1';
const LABEL = 'deck-e2e';
const MAX_LIFETIME_MS = Number(process.env.E2E_MAX_LIFETIME_MIN ?? 45) * 60_000;
const STALE_MS = 2 * 3_600_000;

async function api(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`hetzner ${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

export function createHetznerTarget({ runId, token = process.env.HCLOUD_TOKEN }) {
  if (!token) throw new Error('HCLOUD_TOKEN is not set');
  const name = `deck-e2e-${runId}`;
  const type = process.env.HCLOUD_SERVER_TYPE ?? 'cx22';
  const location = process.env.HCLOUD_LOCATION ?? 'nbg1';
  const keyDir = mkdtempSync(join(tmpdir(), 'deck-e2e-key-'));
  const keyPath = join(keyDir, 'id');
  let serverId = null;
  let sshKeyId = null;
  let ip = null;
  let killer = null;
  const sshArgs = () => ['-i', keyPath, '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15', `root@${ip}`];

  async function sweepStale() {
    const { servers } = await api(token, 'GET', `/servers?label_selector=${LABEL}`);
    for (const s of servers) {
      if (Date.now() - Date.parse(s.created) > STALE_MS) await api(token, 'DELETE', `/servers/${s.id}`).catch(() => {});
    }
  }

  const target = {
    kind: 'hetzner',
    systemd: true,
    async provision() {
      await sweepStale();
      await mustRun('ssh-keygen', ['-t', 'ed25519', '-N', '', '-q', '-f', keyPath]);
      const key = await api(token, 'POST', '/ssh_keys', { name, public_key: readFileSync(`${keyPath}.pub`, 'utf8').trim(), labels: { [LABEL]: 'true' } });
      sshKeyId = key.ssh_key.id;
      const created = await api(token, 'POST', '/servers', {
        name, server_type: type, image: 'ubuntu-24.04', location, ssh_keys: [sshKeyId], labels: { [LABEL]: 'true' }, start_after_create: true,
      });
      serverId = created.server.id;
      killer = setTimeout(async () => {
        console.error(`[e2e] hard max lifetime hit (${MAX_LIFETIME_MS / 60_000} min), destroying server`);
        await target.destroy();
        process.exit(2);
      }, MAX_LIFETIME_MS);
      killer.unref?.();
      for (let i = 0; i < 60; i++) {
        const { server } = await api(token, 'GET', `/servers/${serverId}`);
        if (server.status === 'running') { ip = server.public_net.ipv4.ip; break; }
        await new Promise((r) => setTimeout(r, 5000));
      }
      if (!ip) throw new Error('server never reached running');
      for (let i = 0; i < 60; i++) {
        const r = await run('ssh', [...sshArgs(), 'true'], { timeoutMs: 20_000 });
        if (r.code === 0) return `server ${name} (${type}, ${location}) at ${ip}`;
        await new Promise((r2) => setTimeout(r2, 5000));
      }
      throw new Error('ssh never became reachable');
    },
    exec(script, opts) {
      return run('ssh', [...sshArgs(), 'bash -l -s'], { ...opts, input: script });
    },
    async destroy() {
      clearTimeout(killer);
      if (serverId) await api(token, 'DELETE', `/servers/${serverId}`).catch((e) => console.error(`[e2e] server delete failed: ${e.message}`));
      if (sshKeyId) await api(token, 'DELETE', `/ssh_keys/${sshKeyId}`).catch((e) => console.error(`[e2e] ssh key delete failed: ${e.message}`));
      serverId = null;
      sshKeyId = null;
      rmSync(keyDir, { recursive: true, force: true });
    },
  };
  return target;
}
