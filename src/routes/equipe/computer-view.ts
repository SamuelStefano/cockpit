import type { BotComputer, TeamProfile } from '../../../shared/protocol';
import type { MascotState } from '../../components/team/mascot-state';
import { formatSize } from './file-groups';

type Tone = 'neutral' | 'orange' | 'green' | 'red' | 'yellow';

const STATE: Record<MascotState, { label: string; tone: Tone }> = {
  idle: { label: 'Parado', tone: 'neutral' },
  thinking: { label: 'Pensando', tone: 'orange' },
  working: { label: 'Trabalhando', tone: 'orange' },
  waiting: { label: 'Esperando você', tone: 'yellow' },
  blocked: { label: 'Travado', tone: 'red' },
  done: { label: 'Terminou', tone: 'green' },
};

export const computerState = (s: MascotState) => STATE[s] ?? STATE.idle;

export function diskLine(c: Pick<BotComputer, 'files' | 'bytes' | 'truncated'>): string {
  if (!c.files) return 'vazio';
  const n = `${c.files}${c.truncated ? '+' : ''} ${c.files === 1 ? 'arquivo' : 'arquivos'}`;
  return `${n} · ${formatSize(c.bytes)}`;
}

export function profileLine(profile: TeamProfile | undefined): string {
  return profile === 'restricted'
    ? 'Perfil travado: o bot só alcança este workspace.'
    : 'Perfil completo: o bot trabalha nesta máquina; o terminal abre no workspace dele.';
}

export const COMPUTER_POLL_MS = 2000;
export const PREVIEW_LINES = 12;

export function computerActive(state: MascotState, termAlive: boolean): boolean {
  return termAlive || state === 'thinking' || state === 'working';
}

export function previewText(lines: string[], max = PREVIEW_LINES): string {
  return lines.slice(-max).join('\n');
}
