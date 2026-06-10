import type { ModelInfo } from '../../shared/protocol';
import { broadcast } from './broadcast';
import { readOAuthToken, OAUTH_BETA } from '../oauth';

// Modelos concretos disponíveis na conta (claude-opus-4-8, etc). Lê o token OAuth
// do CLI e consulta /v1/models. SEGURANÇA: o token NUNCA sai do servidor — só a
// lista de ids/nomes vai pro cliente. Refaz de hora em hora pra pegar modelos
// novos que a Anthropic disponibilize, sem o usuário reiniciar nada.
const MODELS_URL = 'https://api.anthropic.com/v1/models?limit=100';
const POLL_MS = 60 * 60_000;
// Token OAuth do CLI é refrescado fora do nosso controle: no boot ele pode estar
// num intervalo de refresh (file mid-write) e o fetch falha. Sem lista, a UI cai
// no fallback opus/sonnet/haiku — então re-tenta rápido por alguns minutos em vez
// de esperar o ciclo horário inteiro. Limitado pra não martelar a API se deslogado.
const RETRY_MS = 30_000;
const MAX_FAST_RETRIES = 12;

let last: ModelInfo[] = [];
export function getLastModels() { return last; }

// Busca e memoiza a lista (sem broadcast). Usado pelo agente T3 (dial), que não tem
// um WebSocketServer pra rodar o startModelsLoop do modo listen — ele chama isto e
// emite o frame `models` pelo próprio socket de saída.
export async function refreshModels(): Promise<ModelInfo[]> {
  const m = await fetchModels();
  if (m && m.length) last = m;
  return last;
}

// A lista vai INTEIRA pro seletor, na ordem da Anthropic (novo primeiro) — pedido
// do Samuel (2026-06-10): "puxe igual aos da anthropic, inclusive os novos". Só
// filtramos ids não-Claude, que o validador de --model do servidor recusaria.
export function mapModels(body: unknown): ModelInfo[] {
  const b = body as { data?: Array<{ id?: unknown; display_name?: unknown }> };
  if (!Array.isArray(b?.data)) return [];
  const out: ModelInfo[] = [];
  for (const m of b.data) {
    if (typeof m?.id !== 'string' || !/^claude-/.test(m.id)) continue;
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

export function startModelsLoop(hasClients: () => boolean) {
  let fastRetries = 0;
  const tick = async (force = false) => {
    if (!force && !hasClients()) return;
    const m = await fetchModels();
    if (m && m.length) {
      last = m;
      fastRetries = 0;
      broadcast({ t: 'models', models: m });
      return;
    }
    // Falhou e ainda nem temos uma lista: re-tenta rápido (token em refresh/rede)
    // por ~6min antes de cair no poll horário, pra a versão real aparecer sem o
    // usuário ter de clicar refresh nem reiniciar nada.
    if (last.length === 0 && fastRetries < MAX_FAST_RETRIES) {
      fastRetries++;
      setTimeout(() => tick(true), RETRY_MS).unref();
    }
  };
  tick(true);
  setInterval(() => tick(), POLL_MS).unref();
}
