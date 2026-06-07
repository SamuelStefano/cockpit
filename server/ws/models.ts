import type { WebSocketServer } from 'ws';
import type { ModelInfo } from '../../shared/protocol';
import { broadcast } from './broadcast';
import { readOAuthToken, OAUTH_BETA } from '../oauth';

// Modelos concretos disponíveis na conta (claude-opus-4-8, etc). Lê o token OAuth
// do CLI e consulta /v1/models. SEGURANÇA: o token NUNCA sai do servidor — só a
// lista de ids/nomes vai pro cliente. Refaz de hora em hora pra pegar modelos
// novos que a Anthropic disponibilize, sem o usuário reiniciar nada.
const MODELS_URL = 'https://api.anthropic.com/v1/models?limit=100';
const POLL_MS = 60 * 60_000;

let last: ModelInfo[] = [];
export function getLastModels() { return last; }

// A lista da Anthropic vem do mais novo pro mais antigo. Enxugamos pra não poluir
// o seletor: no máximo as 2 versões mais recentes do Opus, e só a última de cada
// um dos outros tipos (Sonnet, Haiku). Mantém a ordem original (novo primeiro).
const FAMILY_CAP: Record<string, number> = { opus: 2, sonnet: 1, haiku: 1 };

function familyOf(id: string): string | null {
  for (const fam of Object.keys(FAMILY_CAP)) if (id.includes(fam)) return fam;
  return null;
}

export function limitModels(models: ModelInfo[]): ModelInfo[] {
  const seen: Record<string, number> = {};
  const out: ModelInfo[] = [];
  for (const m of models) {
    const fam = familyOf(m.id);
    if (!fam) continue;
    const n = seen[fam] ?? 0;
    if (n >= FAMILY_CAP[fam]) continue;
    seen[fam] = n + 1;
    out.push(m);
  }
  return out;
}

export function mapModels(body: unknown): ModelInfo[] {
  const b = body as { data?: Array<{ id?: unknown; display_name?: unknown }> };
  if (!Array.isArray(b?.data)) return [];
  const out: ModelInfo[] = [];
  for (const m of b.data) {
    if (typeof m?.id !== 'string' || !m.id) continue;
    const displayName = typeof m.display_name === 'string' && m.display_name ? m.display_name : m.id;
    out.push({ id: m.id, displayName });
  }
  return limitModels(out);
}

export async function fetchModels(): Promise<ModelInfo[] | null> {
  const token = await readOAuthToken();
  if (!token) return null;
  let res: Response;
  try {
    res = await fetch(MODELS_URL, {
      headers: {
        authorization: `Bearer ${token}`,
        'anthropic-beta': OAUTH_BETA,
        'anthropic-version': '2023-06-01',
      },
    });
  } catch { return null; }
  if (!res.ok) return null;
  try { return mapModels(await res.json()); } catch { return null; }
}

export function startModelsLoop(wss: WebSocketServer) {
  const tick = async (force = false) => {
    if (!force && wss.clients.size === 0) return;
    const m = await fetchModels();
    if (!m || m.length === 0) return;
    last = m;
    broadcast({ t: 'models', models: m });
  };
  tick(true);
  setInterval(() => tick(), POLL_MS).unref();
}
