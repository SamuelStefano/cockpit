import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { BYO_KEY_RE, BYO_PROVIDERS, byoProviderById, type ByoKeyView, type ByoProviderId } from '../../shared/byo-providers';

// Seam for the box vault: swap this implementation, nothing else reads the file.
export interface ByoKeyStore {
  get(provider: ByoProviderId): string | undefined;
  set(provider: ByoProviderId, key: string): void;
  remove(provider: ByoProviderId): void;
}

type KeyFile = Partial<Record<ByoProviderId, string>>;

export function fileKeyStore(path = join(homedir(), '.deck-agent', 'byo-keys.json')): ByoKeyStore {
  const read = (): KeyFile => {
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8')) as KeyFile;
      return raw && typeof raw === 'object' ? raw : {};
    } catch { return {}; }
  };
  const write = (data: KeyFile) => {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
    chmodSync(tmp, 0o600);
    renameSync(tmp, path);
  };
  return {
    get: (provider) => {
      const v = read()[provider];
      return typeof v === 'string' && BYO_KEY_RE.test(v) ? v : undefined;
    },
    set: (provider, key) => write({ ...read(), [provider]: key }),
    remove: (provider) => {
      const { [provider]: _gone, ...rest } = read();
      write(rest);
    },
  };
}

export const byoKeys: ByoKeyStore = fileKeyStore();

export function saveByoKey(store: ByoKeyStore, provider: string, key: string): { ok: boolean; message: string } {
  const p = byoProviderById(provider);
  if (!p) return { ok: false, message: 'provedor desconhecido' };
  const trimmed = typeof key === 'string' ? key.trim() : '';
  if (!BYO_KEY_RE.test(trimmed)) return { ok: false, message: 'chave inválida: 8 a 256 caracteres, sem espaços' };
  store.set(p.id, trimmed);
  return { ok: true, message: `chave do ${p.name} salva nesta VPS` };
}

export function removeByoKey(store: ByoKeyStore, provider: string): { ok: boolean; message: string } {
  const p = byoProviderById(provider);
  if (!p) return { ok: false, message: 'provedor desconhecido' };
  store.remove(p.id);
  return { ok: true, message: `chave do ${p.name} removida` };
}

export function byoKeyViews(store: ByoKeyStore): ByoKeyView[] {
  return BYO_PROVIDERS.map((p) => {
    const key = store.get(p.id);
    return key ? { provider: p.id, configured: true, last4: key.slice(-4) } : { provider: p.id, configured: false };
  });
}
