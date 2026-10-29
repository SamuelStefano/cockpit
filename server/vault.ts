import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { VaultItem } from '../shared/protocol';

// Per-box vault: secrets live only on this box, AES-256-GCM encrypted in one 0600
// file. The key sits in a separate 0600 file so a copy of the data dir alone is
// useless. No function here returns a value to the protocol layer: the list is
// names + metadata, and values leave only through vaultEnvSync (spawn env).

const NAME_RE = /^[A-Z_][A-Z0-9_]{0,63}$/;
const AGENT_RE = /^[a-z0-9][a-z0-9._-]{0,39}$/;
const RESERVED_RE = /^(PATH|HOME|SHELL|IFS|ENV|BASH_ENV|NODE_OPTIONS|NODE_PATH|PYTHONPATH|PYTHONSTARTUP|PERL5OPT|RUBYOPT|NODE_EXTRA_CA_CERTS|SSL_CERT_FILE|SSL_CERT_DIR|ANTHROPIC_.*|LD_.*|DYLD_.*|CLAUDE_.*|GIT_.*|(HTTPS?|ALL|NO|FTP)_PROXY)$/;
const MAX_VALUE_BYTES = 16_384;
const MAX_ENTRIES = 200;
const MAX_AGENTS = 20;
const MIN_REDACT_LEN = 6;
const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

interface Entry { value: string; agents: string[]; createdAt: number; updatedAt: number }
type Store = Record<string, Entry>;

function vaultFile(): string {
  return process.env.COCKPIT_VAULT_FILE ?? join(homedir(), '.deck-vault', 'vault.enc');
}

function keyFile(): string {
  return process.env.COCKPIT_VAULT_KEY_FILE ?? join(homedir(), '.deck-agent', 'vault.key');
}

export function validVaultName(name: unknown): name is string {
  return typeof name === 'string' && NAME_RE.test(name) && !RESERVED_RE.test(name);
}

function cleanAgents(agents: unknown): string[] | null {
  if (agents === undefined) return [];
  if (!Array.isArray(agents) || agents.length > MAX_AGENTS) return null;
  const out = new Set<string>();
  for (const a of agents) {
    if (typeof a !== 'string' || !AGENT_RE.test(a)) return null;
    out.add(a);
  }
  return [...out];
}

function secureDir(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: DIR_MODE });
  chmodSync(dir, DIR_MODE);
}

function loadKey(create: boolean): Buffer | null {
  const file = keyFile();
  if (existsSync(file)) {
    const key = Buffer.from(readFileSync(file, 'utf8').trim(), 'hex');
    if (key.length !== 32) throw new Error('vault key file is corrupt');
    return key;
  }
  if (!create) return null;
  secureDir(dirname(file));
  const key = randomBytes(32);
  writeFileSync(file, key.toString('hex'), { mode: FILE_MODE, flag: 'wx' });
  chmodSync(file, FILE_MODE);
  return key;
}

export function encryptStore(store: Store, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(store), 'utf8'), cipher.final()]);
  return JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') });
}

export function decryptStore(raw: string, key: Buffer): Store {
  const j = JSON.parse(raw) as { v: number; iv: string; tag: string; data: string };
  if (j.v !== 1) throw new Error('unknown vault format');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(j.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(j.tag, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(j.data, 'base64')), decipher.final()]).toString('utf8');
  const parsed = JSON.parse(plain) as Store;
  const out: Store = Object.create(null) as Store;
  for (const [name, e] of Object.entries(parsed)) {
    if (validVaultName(name) && typeof e?.value === 'string') {
      out[name] = { value: e.value, agents: cleanAgents(e.agents) ?? [], createdAt: Number(e.createdAt) || 0, updatedAt: Number(e.updatedAt) || 0 };
    }
  }
  return out;
}

let cache: { mtime: number; store: Store } | null = null;

// A corrupt or undecryptable file must NOT read as an empty vault: the next put
// would overwrite every secret. It throws instead and the callers surface it.
function readStore(): Store {
  const file = vaultFile();
  let mtime: number;
  try { mtime = statSync(file).mtimeMs; } catch { return Object.create(null) as Store; }
  if (cache && cache.mtime === mtime) return cache.store;
  const key = loadKey(false);
  if (!key) throw new Error('vault key file is missing');
  const store = decryptStore(readFileSync(file, 'utf8'), key);
  cache = { mtime, store };
  return store;
}

function writeStore(store: Store): void {
  const key = loadKey(true)!;
  const file = vaultFile();
  secureDir(dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, encryptStore(store, key), { mode: FILE_MODE });
  chmodSync(tmp, FILE_MODE);
  renameSync(tmp, file);
  cache = null;
}

let chain: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => T): Promise<T> {
  const next = chain.then(fn);
  chain = next.catch(() => undefined);
  return next;
}

function toItem(name: string, e: Entry): VaultItem {
  return { name, bytes: Buffer.byteLength(e.value, 'utf8'), agents: e.agents, createdAt: e.createdAt, updatedAt: e.updatedAt };
}

export function listSecrets(): VaultItem[] {
  try {
    return Object.entries(readStore()).map(([n, e]) => toItem(n, e)).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export function putSecret(name: unknown, value: unknown, agents?: unknown): Promise<VaultItem | { error: string }> {
  if (!validVaultName(name)) return Promise.resolve({ error: 'invalid secret name' });
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) return Promise.resolve({ error: 'invalid secret value' });
  if (Buffer.byteLength(value, 'utf8') > MAX_VALUE_BYTES) return Promise.resolve({ error: 'secret value too large' });
  const allow = cleanAgents(agents);
  if (!allow) return Promise.resolve({ error: 'invalid agent allowlist' });
  return serialized(() => {
    const store = readStore();
    if (!(name in store) && Object.keys(store).length >= MAX_ENTRIES) return { error: 'vault is full' };
    const now = Date.now();
    const next: Store = Object.assign(Object.create(null) as Store, store);
    next[name] = { value, agents: allow, createdAt: store[name]?.createdAt ?? now, updatedAt: now };
    writeStore(next);
    return toItem(name, next[name]);
  }).catch(() => ({ error: 'vault unavailable' }));
}

export function removeSecret(name: unknown): Promise<{ ok: true } | { error: string }> {
  if (!validVaultName(name)) return Promise.resolve({ error: 'invalid secret name' });
  return serialized(() => {
    const store = readStore();
    if (!(name in store)) return { ok: true as const };
    const next: Store = Object.assign(Object.create(null) as Store, store);
    delete next[name];
    writeStore(next);
    return { ok: true as const };
  }).catch(() => ({ error: 'vault unavailable' }));
}

export function vaultEnvSync(agentId: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const [name, e] of Object.entries(readStore())) {
      if (e.agents.includes(agentId)) out[name] = e.value;
    }
  } catch { /* unreadable vault injects nothing */ }
  return out;
}

export type Redactor = (text: string) => string;

const identity: Redactor = (t) => t;

// Built from the exact values injected into one spawn. Matches the raw value and
// its JSON-escaped form, so it works on a serialized event line too.
export function makeRedactor(env: Record<string, string>): Redactor {
  const rules: Array<[string, string]> = [];
  for (const [name, value] of Object.entries(env)) {
    if (value.length < MIN_REDACT_LEN) continue;
    const tag = `[vault:${name}]`;
    rules.push([value, tag]);
    const escaped = JSON.stringify(value).slice(1, -1);
    if (escaped !== value) rules.push([escaped, tag]);
  }
  if (!rules.length) return identity;
  rules.sort((a, b) => b[0].length - a[0].length);
  return (text) => {
    let out = text;
    for (const [needle, tag] of rules) if (out.includes(needle)) out = out.split(needle).join(tag);
    return out;
  };
}
