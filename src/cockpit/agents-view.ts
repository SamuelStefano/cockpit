import { agentSteps, type AgentPreset, type AgentStatus, type AgentView } from '../../shared/agents';
import type { BitState } from '../components/bit/bit-state';

export interface AgentCardModel {
  preset: AgentPreset;
  item: AgentView | null;
  status: AgentStatus;
  activeStep: number;
  custom: boolean;
}

export const STATUS_LABEL: Record<AgentStatus, string> = {
  ready: 'Pronto',
  'needs-login': 'Falta entrar',
  'not-installed': 'Não instalado',
  error: 'Erro',
  unknown: 'Não testado ainda',
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
  return status === 'unknown' ? 0 : 2;
}

export function buildCards(presets: AgentPreset[], items: AgentView[]): AgentCardModel[] {
  return presets.map((preset) => {
    const item = items.find((i) => i.preset === preset.id || i.id === preset.id) ?? null;
    const status: AgentStatus = item?.status ?? 'unknown';
    return { preset, item, status, activeStep: item ? activeStepFor(status) : 0, custom: false };
  });
}

export function customItems(presets: AgentPreset[], items: AgentView[]): AgentView[] {
  return items.filter((i) => !presets.some((p) => p.id === i.id || p.id === i.preset));
}

export function splitArgs(raw: string): string[] {
  return raw.trim().split(/\s+/).filter(Boolean);
}

export const TEST_PHRASES = ['Abrindo o agente…', 'Mandando um oi…', 'Esperando a resposta…'];

export function phraseAt(i: number): string {
  return TEST_PHRASES[((i % TEST_PHRASES.length) + TEST_PHRASES.length) % TEST_PHRASES.length];
}

export const STEP_COUNT = 3;

export function progressFor(status: AgentStatus, connected: boolean): number {
  if (!connected) return 0;
  if (status === 'ready') return STEP_COUNT;
  return status === 'needs-login' ? 1 : 0;
}

export function bitStateForAgent(status: AgentStatus, testing: boolean, celebrating: boolean): BitState {
  if (testing) return 'thinking';
  if (celebrating) return 'happy';
  if (status === 'needs-login') return 'connecting';
  if (status === 'not-installed') return 'sleeping';
  return status === 'error' ? 'error' : 'idle';
}

export function customCards(presets: AgentPreset[], items: AgentView[]): AgentCardModel[] {
  return customItems(presets, items).map((item) => ({
    preset: {
      id: item.id, name: item.name, vendor: 'Personalizado', source: 'closed', command: item.command, args: item.args,
      install: item.install, login: item.login,
      blurb: `Roda ${[item.command, ...item.args].join(' ')}.`, steps: agentSteps(item), docs: '',
    },
    item, status: item.status, activeStep: activeStepFor(item.status), custom: true,
  }));
}

// Ready first, then connected ones, then the rest — each group keeps its order.
export function sortCards(cards: AgentCardModel[]): AgentCardModel[] {
  const rank = (c: AgentCardModel) => (c.status === 'ready' && c.item ? 0 : c.item ? 1 : 2);
  return cards.map((c, i) => ({ c, i })).sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i).map((x) => x.c);
}

export function defaultSelection(cards: AgentCardModel[]): string | null {
  const pending = cards.find((c) => c.item && c.status !== 'ready');
  return (pending ?? cards.find((c) => c.preset.id === 'grok') ?? cards[0])?.preset.id ?? null;
}

export function newlyReady(prev: Record<string, AgentStatus>, items: AgentView[]): string[] {
  return items.filter((i) => i.status === 'ready' && prev[i.id] !== undefined && prev[i.id] !== 'ready').map((i) => i.id);
}

const TINTS = [
  'border-sky-500/25 bg-sky-500/10 text-sky-300',
  'border-violet-500/25 bg-violet-500/10 text-violet-300',
  'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  'border-rose-500/25 bg-rose-500/10 text-rose-300',
  'border-amber-500/25 bg-amber-500/10 text-amber-300',
  'border-teal-500/25 bg-teal-500/10 text-teal-300',
];

export function tintFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

export function monogram(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

export const NEXT_ACTION: Partial<Record<AgentStatus, string>> = {
  'not-installed': 'Falta instalar: rode o passo 1 no terminal.',
  'needs-login': 'Falta entrar: rode o passo 2 no terminal.',
  error: 'O teste falhou. Veja o motivo e tente de novo.',
};

export interface CustomSaveGate {
  allowed: boolean;
  reason?: string;
}

// UX mirror of the server gate (relay: root only; engine: owner's box). The
// server enforces it either way; this only explains a disabled form.
export function customSaveGate(customAllowed: boolean, isRoot: boolean, relayMode: boolean): CustomSaveGate {
  if (relayMode && !isRoot) return { allowed: false, reason: 'Só a conta root salva agente novo: ele roda um comando nesta VPS.' };
  if (!customAllowed) return { allowed: false, reason: 'Este Deck não está marcado como a máquina do dono. Edite ~/.deck-agent/agents.json na VPS.' };
  return { allowed: true };
}

// "gemini --experimental-acp" → executable + argv. No quoting on purpose: the
// server refuses quotes and spaces inside an argument anyway.
export function parseCommandLine(raw: string): { command: string; args: string[] } {
  const [command = '', ...args] = splitArgs(raw);
  return { command, args };
}

export function slugFromName(name: string): string {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^[^a-z]+/, '').replace(/-+$/, '');
  return slug.slice(0, 32).replace(/-+$/, '');
}
