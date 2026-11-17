import type { TeamBot } from '../../../../shared/protocol';
import { isAgentModel } from '../../../../shared/agents';
import { MEETING_LIMITS, answerOf, type MeetingStatus, type TeamMeeting } from '../../../../shared/team-meeting';

export const MEETING_ACCENT = '#a78bfa';

export const STATUS_LABEL: Record<MeetingStatus, string> = {
  round1: 'Rodada 1',
  round2: 'Rodada 2',
  minutes: 'Escrevendo a ata',
  done: 'Concluída',
  failed: 'Falhou',
};

export type SeatState = 'sealed' | 'writing' | 'shown' | 'waiting';

// What a participant's seat shows for a round. Round 1 text only counts as shown
// once the round has closed; while it is open a delivered answer is "sealed".
export function seatState(m: TeamMeeting, botId: string, round: 1 | 2): SeatState {
  const delivered = answerOf(m, botId, round) !== undefined;
  if (round === 1) {
    if (m.status === 'round1') return delivered ? 'sealed' : 'writing';
    return delivered ? 'shown' : 'waiting';
  }
  if (delivered) return 'shown';
  return m.status === 'round2' ? 'writing' : 'waiting';
}

export const SEAT_LABEL: Record<SeatState, string> = {
  sealed: 'entregue, lacrada',
  writing: 'escrevendo…',
  shown: '',
  waiting: 'não respondeu',
};

export function defaultModeratorId(bots: TeamBot[]): string {
  return (bots.find((b) => b.primary) ?? bots[0])?.id ?? '';
}

export function botBlock(bot: TeamBot): string | null {
  return isAgentModel(bot.model) ? 'agente externo não participa' : null;
}

export function formBlock(canEdit: boolean, bots: TeamBot[]): string | null {
  if (!canEdit) return 'Só o admin abre reuniões';
  if (bots.filter((b) => !botBlock(b)).length < MEETING_LIMITS.minParticipants) return 'A equipe precisa de pelo menos 2 agentes';
  return null;
}

export function submitBlock(question: string, picked: number): string | null {
  if (!question.trim()) return 'Escreva a pergunta';
  if (picked < MEETING_LIMITS.minParticipants) return `Escolha pelo menos ${MEETING_LIMITS.minParticipants} participantes`;
  if (picked > MEETING_LIMITS.maxParticipants) return `No máximo ${MEETING_LIMITS.maxParticipants} participantes`;
  return null;
}
