// Bring-your-own-key providers: OpenAI-compatible chat completions endpoints the
// Deck calls with a key that lives on the box. A model shows up in the picker as
// `agent:byo-<provider>-<slug>` once its provider has a key.

export type ByoProviderId = 'openrouter' | 'zai' | 'deepseek';

export interface ByoModel {
  slug: string;
  id: string;
  label: string;
}

export interface ByoProvider {
  id: ByoProviderId;
  name: string;
  blurb: string;
  baseUrl: string;
  keyUrl: string;
  models: ByoModel[];
}

export const BYO_PROVIDERS: ByoProvider[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    blurb: 'Uma chave, centenas de modelos. Você paga por uso direto no OpenRouter.',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyUrl: 'https://openrouter.ai/keys',
    models: [
      { slug: 'gpt', id: 'openai/gpt-5.2', label: 'GPT-5.2' },
      { slug: 'glm', id: 'z-ai/glm-4.6', label: 'GLM 4.6' },
      { slug: 'deepseek', id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
    ],
  },
  {
    id: 'zai',
    name: 'Z.ai (GLM)',
    blurb: 'Modelos GLM direto da Z.ai, com a sua chave de API.',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    keyUrl: 'https://z.ai/manage-apikey/apikey-list',
    models: [
      { slug: 'glm-4-6', id: 'glm-4.6', label: 'GLM 4.6' },
      { slug: 'glm-4-6-air', id: 'glm-4.6-air', label: 'GLM 4.6 Air' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    blurb: 'DeepSeek direto da API, barato e rápido, com a sua chave.',
    baseUrl: 'https://api.deepseek.com',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    models: [
      { slug: 'chat', id: 'deepseek-chat', label: 'DeepSeek Chat' },
      { slug: 'reasoner', id: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
    ],
  },
];

export const BYO_AGENT_PREFIX = 'byo-';

export const BYO_KEY_RE = /^[\x21-\x7e]{8,256}$/;

export function byoProviderById(id: string): ByoProvider | undefined {
  return BYO_PROVIDERS.find((p) => p.id === id);
}

export function byoAgentId(provider: ByoProviderId, slug: string): string {
  return `${BYO_AGENT_PREFIX}${provider}-${slug}`;
}

export function byoModelOf(model: string | undefined | null): { provider: ByoProvider; model: ByoModel } | null {
  if (typeof model !== 'string' || !model.startsWith(`agent:${BYO_AGENT_PREFIX}`)) return null;
  const agentId = model.slice('agent:'.length);
  for (const provider of BYO_PROVIDERS) {
    const found = provider.models.find((m) => byoAgentId(provider.id, m.slug) === agentId);
    if (found) return { provider, model: found };
  }
  return null;
}

export interface ByoKeyView {
  provider: ByoProviderId;
  configured: boolean;
  last4?: string;
}
