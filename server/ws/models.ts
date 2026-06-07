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

export function mapModels(body: unknown): ModelInfo[] {
  const b = body as { data?: Array<{ id?: unknown; display_name?: unknown }> };
  if (!Array.isArray(b?.data)) return [];
  const out: ModelInfo[] = [];
  for (const m of b.data) {
    if (typeof m?.id !== 'string' || !m.id) continue;
    const displayName = typeof m.display_name === 'string' && m.display_name ? m.display_name : m.id;
    out.push({ id: m.id, displayName });
  }
  return out;
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
