import { presetById, type AgentPreset, type AgentView } from '../../shared/agents';

export type ProviderId = 'claude' | 'grok' | 'opencode' | 'codex' | 'gemini';
export type ProviderStatus = 'ready' | 'needs-login' | 'missing' | 'unknown';

export interface ProviderCardModel {
  id: ProviderId;
  label: string;
  blurb: string;
  status: ProviderStatus;
  install?: string;
  login?: string;
  soon: boolean;
}

export const PROVIDER_STATUS_LABEL: Record<ProviderStatus, string> = {
  ready: 'Instalado e logado',
  'needs-login': 'Instalado, falta entrar',
  missing: 'Não instalado',
  unknown: 'Ainda não verificado',
};

export const PROVIDER_STATUS_TONE: Record<ProviderStatus, 'green' | 'yellow' | 'red' | 'neutral'> = {
  ready: 'green',
  'needs-login': 'yellow',
  missing: 'red',
  unknown: 'neutral',
};

const ORDER: Array<{ id: ProviderId; label: string; preset?: string }> = [
  { id: 'claude', label: 'Claude' },
  { id: 'grok', label: 'Grok', preset: 'grok' },
  { id: 'opencode', label: 'OpenCode Go', preset: 'opencode' },
  { id: 'codex', label: 'Codex', preset: 'codex' },
  { id: 'gemini', label: 'Gemini', preset: 'gemini' },
];

function agentStatus(item: AgentView | undefined): ProviderStatus {
  if (!item) return 'unknown';
  if (item.status === 'ready') return 'ready';
  if (item.status === 'needs-login') return 'needs-login';
  return item.status === 'not-installed' ? 'missing' : 'unknown';
}

export function buildProviderCards(presets: AgentPreset[], items: AgentView[], claudeReady: boolean): ProviderCardModel[] {
  return ORDER.map(({ id, label, preset }) => {
    if (!preset) {
      return { id, label, blurb: 'Usa o login do Claude da sua VPS.', status: claudeReady ? 'ready' : 'needs-login', soon: false } satisfies ProviderCardModel;
    }
    const p = presets.find((x) => x.id === preset) ?? presetById(preset);
    const item = items.find((i) => i.id === preset || i.preset === preset);
    const install = item?.install ?? p?.install;
    return { id, label, blurb: p?.blurb ?? '', status: agentStatus(item), install, login: item?.login ?? p?.login, soon: !install };
  });
}

export function defaultProviderSelection(cards: ProviderCardModel[]): ProviderId[] {
  return cards.filter((c) => c.id === 'claude' && c.status !== 'ready').map((c) => c.id);
}

export function toggleProvider(selected: readonly ProviderId[], id: ProviderId): ProviderId[] {
  return selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
}

export function setupTargets(cards: ProviderCardModel[], selected: readonly ProviderId[]): ProviderCardModel[] {
  return cards.filter((c) => selected.includes(c.id));
}

const FOCUS_KEY = 'deck:agents-focus';

export function requestAgentFocus(presetId: string): void {
  try { sessionStorage.setItem(FOCUS_KEY, presetId); } catch { /* best-effort */ }
}

export function takeAgentFocus(): string | null {
  try {
    const v = sessionStorage.getItem(FOCUS_KEY);
    if (v) sessionStorage.removeItem(FOCUS_KEY);
    return v;
  } catch {
    return null;
  }
}
