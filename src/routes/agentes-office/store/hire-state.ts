import { MAX_BOTS } from '../../../../shared/team';

export function hireBlock(canEdit: boolean, teamSize: number, adding: number, pending: boolean): string | null {
  if (!canEdit) return 'Só administradores contratam agentes.';
  if (pending) return 'Contratando…';
  if (teamSize + adding > MAX_BOTS) return `A equipe passaria do limite de ${MAX_BOTS} agentes.`;
  return null;
}

export const alreadyHired = (team: readonly { label: string }[], role: string) =>
  team.some((b) => b.label.trim().toLowerCase() === role.toLowerCase());

export const skillsLabel = (n: number) => `${n} ${n === 1 ? 'habilidade' : 'habilidades'}`;
