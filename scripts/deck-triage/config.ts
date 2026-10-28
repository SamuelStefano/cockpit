import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const OWNER_CHAT_ID = 8831502964;
export const RELAY_HOSTNAME = 'deck-relay.devfellowship.com';
export const RELAY_IP = '163.176.220.63';
export const RELAY_FALLBACK = 'deck-relay.163-176-220-63.sslip.io';
export const WEB_HOSTNAME = 'deck.devfellowship.com';
export const SPA_URL = 'https://deck.178-105-2-230.sslip.io';
export const APPS = { web: 'PHVXEThUGQVuMKwyeJazl', ops: '_fu5zkgq_89jpNtJVlxXS' } as const;

export interface TriageConfig {
  telegramToken: string;
  chatId: number;
  relay: { host: string; keyFile: string };
  dokploy: { url: string; header: string; token: string } | null;
  anthropicKey: string | null;
  model: string;
  claudeBin: string;
  stateDir: string;
  localRepo: string;
  trustedEmails: Set<string>;
}

export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

export function parseEmailList(raw: string | undefined): Set<string> {
  return new Set((raw ?? '').split(',').map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+$/.test(x)));
}

// A token file readable by group/others is refused, not silently used.
function readSecretFile(path: string): Record<string, string> {
  const st = statSync(path);
  if ((st.mode & 0o077) !== 0) throw new Error(`${path} must be chmod 600`);
  return parseEnvFile(readFileSync(path, 'utf8'));
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): TriageConfig {
  const home = homedir();
  const envFile = env.DECK_TRIAGE_ENV ?? join(home, '.config/deck-triage/env');
  const e = readSecretFile(envFile);
  const token = e.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || !/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) throw new Error(`TELEGRAM_BOT_TOKEN missing or malformed in ${envFile}`);
  const chatId = Number(e.TELEGRAM_CHAT_ID?.trim() || OWNER_CHAT_ID);
  if (!Number.isSafeInteger(chatId) || chatId <= 0) throw new Error('TELEGRAM_CHAT_ID must be a positive integer (the owner private chat)');

  let dokploy: TriageConfig['dokploy'] = null;
  try {
    const d = readSecretFile(e.DOKPLOY_CREDENTIALS || join(home, '.config/dokploy/credentials'));
    if (d.DOKPLOY_URL && d.DOKPLOY_TOKEN) dokploy = { url: d.DOKPLOY_URL.replace(/\/$/, ''), header: d.DOKPLOY_AUTH_HEADER || 'x-api-key', token: d.DOKPLOY_TOKEN };
  } catch { dokploy = null; }

  return {
    telegramToken: token,
    chatId,
    relay: { host: e.RELAY_SSH || 'ubuntu@163.176.220.63', keyFile: e.RELAY_SSH_KEY || join(home, '.ssh/oracle_relay') },
    dokploy,
    anthropicKey: e.ANTHROPIC_API_KEY?.trim() || null,
    model: e.DECK_TRIAGE_MODEL?.trim() || 'claude-sonnet-4-6',
    claudeBin: e.CLAUDE_BIN?.trim() || join(home, '.local/bin/claude'),
    stateDir: e.DECK_TRIAGE_STATE || join(home, '.cache/deck-triage'),
    localRepo: e.DECK_LOCAL_REPO || join(home, 'cockpit'),
    trustedEmails: parseEmailList(e.TRUSTED_REPORTER_EMAILS),
  };
}
