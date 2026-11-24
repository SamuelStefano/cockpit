import { agentIdOf } from './agents';

// Static, versioned catalog. Bump when a provider, preset or capability changes.
export const MODEL_CATALOG_VERSION = 1;

export type Cap = 'vision' | 'tools' | 'longctx' | 'web' | 'local';

export const CAP_LABEL: Record<Cap, string> = {
  vision: 'vê imagens',
  tools: 'usa ferramentas',
  longctx: 'contexto longo',
  web: 'busca na web',
  local: 'roda aqui',
};

export type ProviderId =
  | 'claude' | 'openai' | 'google' | 'xai' | 'zai' | 'deepseek' | 'mistral'
  | 'openrouter' | 'opencode' | 'ollama' | 'lmstudio' | 'custom' | 'other';

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  logo: string;
  bg: string;
  fg: string;
  pay: string;
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  claude: { id: 'claude', name: 'Claude', logo: 'C', bg: '#2b1a10', fg: '#f6a56b', pay: 'assinatura' },
  openai: { id: 'openai', name: 'OpenAI', logo: 'O', bg: '#0f1f1a', fg: '#86efac', pay: 'login' },
  google: { id: 'google', name: 'Google', logo: 'G', bg: '#101a2b', fg: '#93c5fd', pay: 'login Google' },
  xai: { id: 'xai', name: 'xAI', logo: 'X', bg: '#1b1b20', fg: '#e9e9ec', pay: 'login xAI' },
  zai: { id: 'zai', name: 'Z.AI', logo: 'Z', bg: '#1a1a2b', fg: '#a5b4fc', pay: 'chave própria' },
  deepseek: { id: 'deepseek', name: 'DeepSeek', logo: 'D', bg: '#1a1a2b', fg: '#a5b4fc', pay: 'chave própria' },
  mistral: { id: 'mistral', name: 'Mistral', logo: 'M', bg: '#2b1a10', fg: '#fca5a5', pay: 'chave própria' },
  openrouter: { id: 'openrouter', name: 'OpenRouter', logo: 'OR', bg: '#1b1b20', fg: '#e9e9ec', pay: 'chave própria' },
  opencode: { id: 'opencode', name: 'OpenCode', logo: 'OC', bg: '#1b1b20', fg: '#e9e9ec', pay: 'login' },
  ollama: { id: 'ollama', name: 'Ollama', logo: 'Ol', bg: '#1b1b20', fg: '#e9e9ec', pay: 'grátis' },
  lmstudio: { id: 'lmstudio', name: 'LM Studio', logo: 'LM', bg: '#1b1b20', fg: '#e9e9ec', pay: 'grátis' },
  custom: { id: 'custom', name: 'Outro endereço', logo: '+', bg: '#1b1b20', fg: '#e9e9ec', pay: 'endereço próprio' },
  other: { id: 'other', name: 'Outros agentes', logo: 'A', bg: '#1b1b20', fg: '#e9e9ec', pay: 'login' },
};

export const PROVIDER_ORDER: readonly ProviderId[] = [
  'claude', 'openai', 'google', 'xai', 'zai', 'deepseek', 'mistral', 'openrouter', 'opencode', 'ollama', 'lmstudio', 'custom', 'other',
];

const AGENT_PROVIDER: Record<string, ProviderId> = {
  grok: 'xai', gemini: 'google', codex: 'openai', opencode: 'opencode',
};

const AGENT_CAPS: Record<string, Cap[]> = {
  grok: ['vision', 'tools', 'web'],
  gemini: ['vision', 'tools', 'longctx', 'web'],
  codex: ['tools', 'longctx'],
  opencode: ['tools'],
};

const CLAUDE_FAMILY_CAPS: Record<string, Cap[]> = {
  opus: ['vision', 'tools', 'longctx'],
  sonnet: ['vision', 'tools', 'longctx'],
  fable: ['vision', 'tools', 'longctx'],
  haiku: ['vision', 'tools'],
};

const CLAUDE_NICK: Record<string, string> = { haiku: 'mais rápido' };

export interface ModelMeta {
  providerId: ProviderId;
  short: string;
  nick?: string;
  caps: Cap[];
  free: boolean;
}

function claudeFamily(id: string): string | null {
  const m = /(opus|sonnet|haiku|fable)/i.exec(id);
  return m ? m[1].toLowerCase() : null;
}

function shortFromId(id: string): string {
  const fam = claudeFamily(id);
  if (!fam) return id;
  const cap = fam[0].toUpperCase() + fam.slice(1);
  const v = new RegExp(`${fam}-(\\d+)(?:-(\\d{1,2}))?(?![\\d])`, 'i').exec(id) ?? new RegExp(`-(\\d+)(?:-(\\d{1,2}))?-${fam}`, 'i').exec(id);
  if (!v) return cap;
  return v[2] ? `${cap} ${v[1]}.${v[2]}` : `${cap} ${v[1]}`;
}

export function shortModelName(id: string, displayName?: string): string {
  if (id.startsWith('<')) return '';
  const agent = agentIdOf(id);
  if (agent && displayName) return displayName.replace(/\s*·\s*agente\s*$/i, '').trim() || agent;
  if (displayName && displayName !== id) return displayName.replace(/^claude\s+/i, '').trim();
  if (agent) return agent[0].toUpperCase() + agent.slice(1);
  return shortFromId(id);
}

export function describeModel(id: string, displayName?: string): ModelMeta {
  const short = shortModelName(id, displayName);
  const agent = agentIdOf(id);
  if (agent) {
    const providerId = AGENT_PROVIDER[agent] ?? 'other';
    return { providerId, short, caps: AGENT_CAPS[agent] ?? ['tools'], free: false };
  }
  const fam = claudeFamily(id);
  if (fam) {
    return { providerId: 'claude', short, ...(CLAUDE_NICK[fam] ? { nick: CLAUDE_NICK[fam] } : {}), caps: CLAUDE_FAMILY_CAPS[fam] ?? ['tools'], free: false };
  }
  return { providerId: 'claude', short, caps: ['tools'], free: false };
}

export function connectionIdFor(providerId: ProviderId, modelId: string): string {
  const agent = agentIdOf(modelId);
  if (agent) return `provider:${agent}`;
  return `provider:${providerId}`;
}

export type PresetKind = 'login' | 'key' | 'local' | 'custom';

export interface Preset {
  id: ProviderId;
  name: string;
  how: string;
  kind: PresetKind;
  endpoint?: string;
}

export const PRESETS: readonly Preset[] = [
  { id: 'claude', name: 'Claude', how: 'login · Claude Code', kind: 'login' },
  { id: 'openai', name: 'OpenAI · Codex', how: 'login ou chave', kind: 'login' },
  { id: 'google', name: 'Gemini', how: 'login Google', kind: 'login' },
  { id: 'xai', name: 'Grok', how: 'login xAI', kind: 'login' },
  { id: 'zai', name: 'Z.AI · GLM', how: 'chave', kind: 'key', endpoint: 'https://api.z.ai/api/paas/v4' },
  { id: 'deepseek', name: 'DeepSeek', how: 'chave', kind: 'key', endpoint: 'https://api.deepseek.com/v1' },
  { id: 'mistral', name: 'Mistral', how: 'chave', kind: 'key', endpoint: 'https://api.mistral.ai/v1' },
  { id: 'openrouter', name: 'OpenRouter', how: 'chave · centenas de modelos', kind: 'key', endpoint: 'https://openrouter.ai/api/v1' },
  { id: 'opencode', name: 'OpenCode', how: 'login', kind: 'login' },
  { id: 'ollama', name: 'Ollama', how: 'local · detecta sozinho', kind: 'local', endpoint: 'http://127.0.0.1:11434/v1' },
  { id: 'lmstudio', name: 'LM Studio', how: 'local', kind: 'local', endpoint: 'http://127.0.0.1:1234/v1' },
  { id: 'custom', name: 'Outro endereço', how: 'compatível com OpenAI', kind: 'custom' },
];

const CAP_WORDS: Record<Cap | 'free', string[]> = {
  vision: ['visão', 'visao', 'imagem', 'imagens', 'vê', 've', 'foto'],
  tools: ['ferramenta', 'ferramentas', 'tools', 'agente'],
  longctx: ['contexto', 'longo', 'longa', 'livro'],
  web: ['web', 'busca', 'internet'],
  local: ['local', 'aqui', 'offline', 'máquina', 'maquina'],
  free: ['grátis', 'gratis', 'free'],
};

export function searchHaystack(meta: ModelMeta, providerName: string): string {
  const words: string[] = [meta.short, providerName, meta.nick ?? ''];
  for (const c of meta.caps) words.push(CAP_LABEL[c], ...CAP_WORDS[c]);
  if (meta.free) words.push(...CAP_WORDS.free);
  if (meta.nick === 'mais rápido') words.push('rápido', 'rapido');
  if (meta.nick === 'barato') words.push('barato', 'econômico');
  return words.join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function matchesSearch(haystack: string, query: string): boolean {
  const terms = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/).filter(Boolean);
  return terms.every((t) => haystack.includes(t));
}
