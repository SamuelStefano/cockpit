import type { PermMode } from '../../../shared/protocol';

// Matches the mode useCockpit starts with. The composer only flags a mode that
// differs from it, so the box stays quiet in the common case.
export const DEFAULT_MODE: PermMode = 'auto';

export const MODE_CHIP: Record<PermMode, { label: string; tone: string; hint: string }> = {
  plan: { label: 'Planejar', tone: 'bg-neutral-800 text-neutral-300', hint: 'Modo Planejar: só descreve o plano, nada é executado' },
  acceptEdits: { label: 'Executar', tone: 'bg-orange-500/15 text-orange-300', hint: 'Modo Executar: o agente edita arquivos e roda comandos' },
  auto: { label: 'Auto', tone: 'bg-amber-500/15 text-amber-300', hint: 'Modo Auto: roda o ciclo sozinho, com shell' },
};

export function modeChipOf(mode: PermMode): (typeof MODE_CHIP)[PermMode] | null {
  return mode === DEFAULT_MODE ? null : MODE_CHIP[mode];
}
