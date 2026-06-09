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

// Busca e memoiza a lista (sem broadcast). Usado pelo agente T3 (dial), que não tem
// um WebSocketServer pra rodar o startModelsLoop do modo listen — ele chama isto e
// emite o frame `models` pelo próprio socket de saída.
export async function refreshModels(): Promise<ModelInfo[]> {
  const m = await fetchModels();
  if (m && m.length) last = m;
  return last;
}

// A lista da Anthropic vem do mais novo pro mais antigo. Enxugamos pra não poluir
// o seletor: no máximo as 2 versões mais recentes do Opus, e só a última de cada
// um dos outros tipos (Sonnet, Haiku). Mantém a ordem original (novo primeiro).
// Famílias NOVAS (ex: um futuro `claude-fable-*`) aparecem sozinhas, com o cap
// padrão — assim o app acompanha lançamentos da Anthropic sem mexer no código.
const FAMILY_CAP: Record<string, number> = { opus: 2, sonnet: 1, haiku: 1 };
const DEFAULT_CAP = 2;

function familyOf(id: string): string | null {
  for (const fam of Object.keys(FAMILY_CAP)) if (id.includes(fam)) return fam;
  const m = id.match(/claude-([a-z]+)/i); // família desconhecida = palavra após "claude-"
  return m ? m[1].toLowerCase() : null;
}

export function limitModels(models: ModelInfo[]): ModelInfo[] {
  const seen: Record<string, number> = {};
  const out: ModelInfo[] = [];
  for (const m of models) {
    const fam = familyOf(m.id);
    if (!fam) continue;
    const cap = FAMILY_CAP[fam] ?? DEFAULT_CAP;
    const n = seen[fam] ?? 0;
    if (n >= cap) continue;
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

export function startModelsLoop(hasClients: () => boolean) {
  const tick = async (force = false) => {
    if (!force && !hasClients()) return;
    const m = await fetchModels();
    if (!m || m.length === 0) return;
    last = m;
    broadcast({ t: 'models', models: m });
  };
  tick(true);
  setInterval(() => tick(), POLL_MS).unref();
}
