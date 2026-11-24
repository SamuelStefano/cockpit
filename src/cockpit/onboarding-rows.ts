import type { AgentView } from '../../shared/agents';
import type { ClaudeLoginView } from '../../shared/protocol';
import type { ProviderCardModel, ProviderId } from './provider-onboarding';

export type RowState = 'ready' | 'waiting-login' | 'install' | 'error' | 'checking' | 'soon';

export interface RowLogo { letter: string; bg: string; fg: string }

export interface ProviderRowModel {
  id: string;
  name: string;
  logo: RowLogo;
  state: RowState;
  detail: string;
  providerId?: ProviderId;
  command?: string;
}

const LOGOS: Record<string, RowLogo> = {
  claude: { letter: 'C', bg: '#d97757', fg: '#1a0d03' },
  codex: { letter: '◯', bg: '#e9e9ec', fg: '#101013' },
  gemini: { letter: 'G', bg: '#1e3a8a', fg: '#bfdbfe' },
  grok: { letter: '𝕏', bg: '#000', fg: '#fff' },
  opencode: { letter: 'O', bg: '#134e4a', fg: '#99f6e4' },
  zai: { letter: 'Z', bg: '#1f2937', fg: '#93c5fd' },
  deepseek: { letter: 'D', bg: '#172554', fg: '#93c5fd' },
  ollama: { letter: 'L', bg: '#0f172a', fg: '#a5b4fc' },
  custom: { letter: '+', bg: '#27272a', fg: '#a1a1aa' },
};

const NAMES: Record<ProviderId, string> = {
  claude: 'Claude Code',
  codex: 'Codex (OpenAI)',
  gemini: 'Gemini',
  grok: 'Grok',
  opencode: 'OpenCode Go',
};

const WIRED: ProviderId[] = ['claude', 'codex', 'gemini', 'grok', 'opencode'];

const SOON: Array<{ id: string; name: string; detail: string }> = [
  { id: 'zai', name: 'Z.AI (GLM)', detail: 'Chave de API própria' },
  { id: 'deepseek', name: 'DeepSeek', detail: 'Chave de API própria' },
  { id: 'ollama', name: 'Modelo local (Ollama)', detail: 'Detecção em localhost:11434' },
  { id: 'custom', name: 'Outro endereço compatível', detail: 'Qualquer servidor no formato OpenAI' },
];

function claudeRow(ready: boolean, login: ClaudeLoginView | undefined): ProviderRowModel {
  const base = { id: 'claude', name: NAMES.claude, logo: LOGOS.claude, providerId: 'claude' as const };
  if (ready) return { ...base, state: 'ready', detail: 'Conectado' };
  const s = login?.state ?? 'idle';
  if (s === 'url' || s === 'verifying' || s === 'waiting-url') return { ...base, state: 'waiting-login', detail: 'Esperando você entrar no navegador' };
  if (s === 'error') return { ...base, state: 'error', detail: login?.error ?? 'O login não terminou' };
  return { ...base, state: 'install', detail: 'Entre com a sua conta Claude' };
}

function agentRow(card: ProviderCardModel, items: AgentView[], loaded: boolean): ProviderRowModel {
  const id = card.id;
  const base = { id, name: NAMES[id], logo: LOGOS[id], providerId: id };
  if (card.soon) return { ...base, state: 'soon', detail: 'Instalação guiada em breve' };
  const item = items.find((i) => i.id === id || i.preset === id);
  if (item?.status === 'error') return { ...base, state: 'error', detail: item.detail ?? 'Não respondeu ao teste' };
  if (card.status === 'ready') return { ...base, state: 'ready', detail: 'Instalado e logado' };
  if (card.status === 'needs-login') return { ...base, state: 'waiting-login', detail: 'Instalado, falta entrar', command: card.login };
  if (!loaded) return { ...base, state: 'checking', detail: 'Verificando…' };
  return { ...base, state: 'install', detail: 'A ferramenta não está nesta máquina', command: card.install };
}

export function buildOnboardingRows(
  cards: ProviderCardModel[], items: AgentView[], loaded: boolean, claudeReady: boolean, login: ClaudeLoginView | undefined,
): ProviderRowModel[] {
  const wired = WIRED.flatMap((id) => {
    if (id === 'claude') return [claudeRow(claudeReady, login)];
    const card = cards.find((c) => c.id === id);
    return card ? [agentRow(card, items, loaded)] : [];
  });
  const soon = SOON.map((s): ProviderRowModel => ({ id: s.id, name: s.name, logo: LOGOS[s.id], state: 'soon', detail: s.detail }));
  return [...wired, ...soon];
}

export function anyProviderReady(claudeReady: boolean, items: AgentView[]): boolean {
  return claudeReady || items.some((i) => i.status === 'ready');
}
