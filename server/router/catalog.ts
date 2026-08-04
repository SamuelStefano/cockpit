// Catálogo de provedores que o `claude` CLI consegue falar SEM tradutor: todos
// expõem a API da Anthropic (mesmo shape de request/response), então trocar de
// provedor é só trocar ANTHROPIC_BASE_URL + o header de auth + o nome do modelo.
// É o recorte enxuto do OmniRoute: sem camada de tradução N×N, sem executor por
// provedor — o CLI continua sendo o cliente HTTP.

export type ProviderTier = 'plan' | 'free' | 'cheap' | 'paid';

// Alias de modelo que o Deck usa na UI. Todo provedor mapeia os três.
export type ModelSlot = 'opus' | 'sonnet' | 'haiku';

export interface ProviderDef {
  id: string;
  label: string;
  tier: ProviderTier;
  // null = API oficial da Anthropic (o CLI resolve a URL sozinho).
  baseUrl: string | null;
  // Nome da env (gerenciada em ~/.deck-agent/env.json) que guarda a credencial.
  // null = OAuth do plano, sem chave.
  authEnv: string | null;
  // Como a credencial vai pro CLI: 'api-key' vira ANTHROPIC_API_KEY (header
  // x-api-key), 'bearer' vira ANTHROPIC_AUTH_TOKEN (header Authorization).
  authMode: 'oauth' | 'api-key' | 'bearer';
  models: Record<ModelSlot, string>;
  // Prioridade default; menor tenta primeiro. O usuário sobrescreve na config.
  priority: number;
  docsUrl: string;
  note?: string;
}

const PASSTHROUGH: Record<ModelSlot, string> = { opus: 'opus', sonnet: 'sonnet', haiku: 'haiku' };

// Ordem default = plano primeiro (já pago), depois grátis, depois barato, e a API
// pay-as-you-go por último (é a única que gera fatura por token).
export const CATALOG: ProviderDef[] = [
  {
    id: 'anthropic-plan',
    label: 'Anthropic (plano)',
    tier: 'plan',
    baseUrl: null,
    authEnv: null,
    authMode: 'oauth',
    models: PASSTHROUGH,
    priority: 0,
    docsUrl: 'https://claude.com/product/claude-code',
    note: 'Assinatura Max/Pro via OAuth. É a rota preferida enquanto tiver tokens.',
  },
  {
    id: 'qwen-coder',
    label: 'Qwen3 Coder (DashScope)',
    tier: 'free',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/api/v2/apps/claude-code-proxy',
    authEnv: 'DASHSCOPE_API_KEY',
    authMode: 'api-key',
    models: { opus: 'qwen3-coder-plus', sonnet: 'qwen3-coder-plus', haiku: 'qwen3-coder-flash' },
    priority: 10,
    docsUrl: 'https://www.alibabacloud.com/help/en/model-studio/claude-code',
    note: 'Cota grátis mensal de tokens na conta nova.',
  },
  {
    id: 'minimax',
    label: 'MiniMax M2',
    tier: 'free',
    baseUrl: 'https://api.minimax.io/anthropic',
    authEnv: 'MINIMAX_API_KEY',
    authMode: 'bearer',
    models: { opus: 'MiniMax-M2', sonnet: 'MiniMax-M2', haiku: 'MiniMax-M2' },
    priority: 11,
    docsUrl: 'https://platform.minimax.io/docs/guides/text-generation',
    note: 'Trial gratuito de tokens; depois vira pago barato.',
  },
  {
    id: 'zai-glm',
    label: 'Z.AI GLM',
    tier: 'cheap',
    baseUrl: 'https://api.z.ai/api/anthropic',
    authEnv: 'ZAI_API_KEY',
    authMode: 'bearer',
    models: { opus: 'glm-4.6', sonnet: 'glm-4.6', haiku: 'glm-4.5-air' },
    priority: 20,
    docsUrl: 'https://docs.z.ai/devpack/tool/claude',
    note: 'Coding plan mensal barato, sem cobrança por token.',
  },
  {
    id: 'moonshot-kimi',
    label: 'Moonshot Kimi',
    tier: 'cheap',
    baseUrl: 'https://api.moonshot.ai/anthropic',
    authEnv: 'MOONSHOT_API_KEY',
    authMode: 'bearer',
    models: { opus: 'kimi-k2-thinking', sonnet: 'kimi-k2-turbo-preview', haiku: 'kimi-k2-turbo-preview' },
    priority: 21,
    docsUrl: 'https://platform.moonshot.ai/docs/guide/agent-support',
    note: 'Pago por token, ~10x mais barato que a API da Anthropic.',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    tier: 'cheap',
    baseUrl: 'https://api.deepseek.com/anthropic',
    authEnv: 'DEEPSEEK_API_KEY',
    authMode: 'bearer',
    models: { opus: 'deepseek-reasoner', sonnet: 'deepseek-chat', haiku: 'deepseek-chat' },
    priority: 22,
    docsUrl: 'https://api-docs.deepseek.com/guides/anthropic_api',
    note: 'Pago por token, com desconto grande fora do horário de pico.',
  },
  {
    id: 'anthropic-api',
    label: 'Anthropic (créditos de API)',
    tier: 'paid',
    baseUrl: null,
    authEnv: 'ANTHROPIC_API_KEY',
    authMode: 'api-key',
    models: PASSTHROUGH,
    priority: 30,
    docsUrl: 'https://console.anthropic.com/settings/billing',
    note: 'Pay-as-you-go: gera fatura por token. Última opção de propósito.',
  },
];

export const PLAN_PROVIDER_ID = 'anthropic-plan';

export function findProvider(id: string): ProviderDef | undefined {
  return CATALOG.find((p) => p.id === id);
}

// Provedor "custom": o usuário aponta pra qualquer endpoint Anthropic-compat (um
// LiteLLM/OmniRoute local, por exemplo) sem eu ter que versionar o catálogo.
export interface CustomProviderInput {
  id: string;
  label?: string;
  baseUrl: string;
  authEnv?: string;
  authMode?: 'api-key' | 'bearer';
  model?: string;
  smallModel?: string;
  priority?: number;
}

const CUSTOM_ID_RE = /^[a-z][a-z0-9-]{1,31}$/;
const CUSTOM_ENV_RE = /^[A-Z][A-Z0-9_]{1,63}$/;

// baseUrl é o destino pra onde TODO prompt da sessão vai. Um endereço errado aqui
// não é bug de UI, é exfiltração — por isso https obrigatório, sem credencial
// embutida na URL e sem host privado (que serviria pra pivotar dentro da VPS).
// Cobre também as faixas que o WHATWG normaliza pra forma canônica (0x7f000001 e
// 127.1 viram 127.0.0.1) mais CGNAT, benchmark e o IPv6 não-global inteiro —
// inclusive o ::ffff: mapeado, que é loopback disfarçado de IPv6.
const PRIVATE_HOST_RE = /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|198\.1[89]\.|192\.0\.0\.|0\.|localhost$)/i;
const PRIVATE_V6_RE = /^\[?(::1|::|::ffff:|fc|fd|fe[89ab])/i;

export function validateBaseUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let u: URL;
  try { u = new URL(raw); } catch { return { ok: false, error: 'URL inválida' }; }
  if (u.protocol !== 'https:') return { ok: false, error: 'só https é aceito' };
  if (u.username || u.password) return { ok: false, error: 'não coloque credencial na URL' };
  // Ponto final ("localhost.") é o mesmo host pro resolver, mas escaparia do regex.
  const host = u.hostname.replace(/\.$/, '');
  if (PRIVATE_HOST_RE.test(host) || PRIVATE_V6_RE.test(host)) return { ok: false, error: 'host privado/loopback não é aceito' };
  return { ok: true, url: u.toString().replace(/\/$/, '') };
}

export function buildCustomProvider(input: CustomProviderInput): ProviderDef | { error: string } {
  if (!CUSTOM_ID_RE.test(input.id)) return { error: 'id inválido (a-z, 0-9 e hífen)' };
  if (findProvider(input.id)) return { error: 'id já existe no catálogo' };
  const url = validateBaseUrl(input.baseUrl);
  if (!url.ok) return { error: url.error };
  const model = (input.model ?? '').trim();
  if (!model) return { error: 'informe o modelo' };
  const small = (input.smallModel ?? '').trim() || model;
  const authEnv = input.authEnv?.trim() || null;
  if (authEnv && !CUSTOM_ENV_RE.test(authEnv)) return { error: 'nome de env inválido' };
  return {
    id: input.id,
    label: input.label?.trim() || input.id,
    tier: 'free',
    baseUrl: url.url,
    authEnv,
    authMode: input.authMode ?? 'bearer',
    models: { opus: model, sonnet: model, haiku: small },
    priority: input.priority ?? 15,
    docsUrl: url.url,
  };
}

// Revalida um provedor próprio já gravado em disco: o arquivo de config é
// gravável pelo agente, então o que voltou do disco nunca é mais confiável que o
// que entrou pelo WS.
export function isSafeCustom(p: ProviderDef | undefined): boolean {
  if (!p || typeof p !== 'object') return false;
  const built = buildCustomProvider({
    id: String(p.id ?? ''),
    baseUrl: String(p.baseUrl ?? ''),
    model: p.models?.sonnet ?? '',
    authEnv: p.authEnv ?? undefined,
  });
  return 'id' in built;
}

// Alias do Deck → id do provedor. Um id concreto da Anthropic (claude-opus-4-5)
// cai no slot equivalente; qualquer outra coisa passa direto (o usuário digitou o
// id nativo do provedor no picker).
export function mapModel(provider: ProviderDef, requested: string | undefined): string | undefined {
  if (isNativeAnthropic(provider)) return requested;
  if (!requested) return provider.models.sonnet;
  const slot = slotOf(requested);
  return slot ? provider.models[slot] : requested;
}

export function slotOf(model: string): ModelSlot | null {
  const m = model.toLowerCase();
  if (m.includes('opus')) return 'opus';
  if (m.includes('haiku')) return 'haiku';
  if (m.includes('sonnet')) return 'sonnet';
  return null;
}

export function isNativeAnthropic(provider: ProviderDef): boolean {
  return provider.baseUrl === null;
}
