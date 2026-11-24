import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// O login do Grok CLI (`grok login`) guarda um objeto por conta, chaveado por
// `<issuer>::<user>`, com o bearer em `key`. Só leitura: quem renova é o CLI.
// SEGURANÇA: o valor nunca sai daqui pra log nem pro cliente.
const AUTH_PATH = () => process.env.COCKPIT_GROK_AUTH ?? join(homedir(), '.grok', 'auth.json');

interface GrokAuthEntry { key?: unknown; expires_at?: unknown }

// Várias contas no arquivo: a que ainda não venceu ganha; entre as válidas, a de
// vencimento mais distante. Sem `expires_at` legível vale como válida — o 401 do
// endpoint é quem decide, não um palpite daqui.
export function pickGrokToken(raw: unknown, now = Date.now()): string | null {
  if (!raw || typeof raw !== 'object') return null;
  let best: { key: string; exp: number } | null = null;
  for (const v of Object.values(raw as Record<string, GrokAuthEntry>)) {
    if (!v || typeof v !== 'object' || typeof v.key !== 'string' || !v.key) continue;
    const parsed = typeof v.expires_at === 'string' ? Date.parse(v.expires_at) : NaN;
    const exp = Number.isFinite(parsed) ? parsed : Infinity;
    if (exp <= now) continue;
    if (!best || exp > best.exp) best = { key: v.key, exp };
  }
  return best?.key ?? null;
}

export async function readGrokToken(): Promise<string | null> {
  try { return pickGrokToken(JSON.parse(await readFile(AUTH_PATH(), 'utf8'))); } catch { return null; }
}
