import type { AgentPreset, AgentStatus, AgentView } from '../../shared/agents';

export interface AgentCardModel {
  preset: AgentPreset;
  item: AgentView | null;
  status: AgentStatus;
  activeStep: number;
}

export const STATUS_LABEL: Record<AgentStatus, string> = {
  ready: 'Pronto',
  'needs-login': 'Falta entrar',
  'not-installed': 'Não instalado',
  error: 'Erro',
  unknown: 'Não testado',
};

export const STATUS_TONE: Record<AgentStatus, 'green' | 'yellow' | 'red' | 'neutral'> = {
  ready: 'green',
  'needs-login': 'yellow',
  'not-installed': 'red',
  error: 'red',
  unknown: 'neutral',
};

export function activeStepFor(status: AgentStatus): number {
  if (status === 'not-installed') return 0;
  if (status === 'needs-login') return 1;
  return 2;
}

export function buildCards(presets: AgentPreset[], items: AgentView[]): AgentCardModel[] {
  return presets.map((preset) => {
    const item = items.find((i) => i.preset === preset.id || i.id === preset.id) ?? null;
    const status: AgentStatus = item?.status ?? 'unknown';
    return { preset, item, status, activeStep: item ? activeStepFor(status) : 0 };
  });
}

export function customItems(presets: AgentPreset[], items: AgentView[]): AgentView[] {
  return items.filter((i) => !presets.some((p) => p.id === i.id || p.id === i.preset));
}

export function splitArgs(raw: string): string[] {
  return raw.trim().split(/\s+/).filter(Boolean);
}
