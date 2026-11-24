import { isAgentModel } from './agents';

export type MeetingStatus = 'round1' | 'round2' | 'minutes' | 'done' | 'failed';
export type MeetingRound = 1 | 2;

export interface MeetingAnswer { botId: string; round: MeetingRound; text: string; at: number }

export interface TeamMeeting {
  id: string;
  question: string;
  participantIds: string[];
  moderatorId: string;
  status: MeetingStatus;
  answers: MeetingAnswer[];
  minutes?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MeetingInput { question: string; participantIds: string[]; moderatorId: string }

export const MEETING_LIMITS = {
  minParticipants: 2,
  maxParticipants: 6,
  question: 600,
  answer: 1500,
  minutes: 3000,
  error: 200,
  keep: 50,
} as const;

export const RUNNING_STATUSES: readonly MeetingStatus[] = ['round1', 'round2', 'minutes'];

export const isRunning = (m: Pick<TeamMeeting, 'status'>): boolean => RUNNING_STATUSES.includes(m.status);

interface BotRef { id: string; name: string; model?: string }

export type MeetingValidation = { ok: true; input: MeetingInput } | { ok: false; error: string };

export function validateMeetingInput(raw: unknown, team: BotRef[]): MeetingValidation {
  const r = (raw ?? {}) as Record<string, unknown>;
  const question = typeof r.question === 'string' ? r.question.trim() : '';
  if (!question) return { ok: false, error: 'escreva a pergunta da reunião' };
  if (question.length > MEETING_LIMITS.question) return { ok: false, error: `a pergunta passa de ${MEETING_LIMITS.question} caracteres` };
  const ids = Array.isArray(r.participantIds) && r.participantIds.every((x) => typeof x === 'string') ? (r.participantIds as string[]) : null;
  if (!ids) return { ok: false, error: 'participantes inválidos' };
  if (new Set(ids).size !== ids.length) return { ok: false, error: 'participante repetido' };
  if (ids.length < MEETING_LIMITS.minParticipants || ids.length > MEETING_LIMITS.maxParticipants) {
    return { ok: false, error: `escolha de ${MEETING_LIMITS.minParticipants} a ${MEETING_LIMITS.maxParticipants} participantes` };
  }
  const moderatorId = typeof r.moderatorId === 'string' ? r.moderatorId : '';
  for (const id of [...ids, moderatorId]) {
    const bot = team.find((b) => b.id === id);
    if (!bot) return { ok: false, error: id === moderatorId && id ? 'moderador não encontrado' : 'participante não encontrado' };
    if (isAgentModel(bot.model)) return { ok: false, error: `${bot.name} usa um agente externo e não participa de reuniões` };
  }
  return { ok: true, input: { question, participantIds: ids, moderatorId } };
}

export function newMeeting(id: string, input: MeetingInput, now: number): TeamMeeting {
  return { id, ...input, status: 'round1', answers: [], createdAt: now, updatedAt: now };
}

export type MeetingStep =
  | { kind: 'answer'; botId: string; round: MeetingRound }
  | { kind: 'minutes'; botId: string }
  | { kind: 'none' };

export const answerOf = (m: TeamMeeting, botId: string, round: MeetingRound): MeetingAnswer | undefined =>
  m.answers.find((a) => a.botId === botId && a.round === round);

export function nextStep(m: TeamMeeting): MeetingStep {
  if (m.status === 'done' || m.status === 'failed') return { kind: 'none' };
  for (const round of [1, 2] as const) {
    const owed = m.participantIds.find((id) => !answerOf(m, id, round));
    if (owed) return { kind: 'answer', botId: owed, round };
  }
  if (m.minutes === undefined) return { kind: 'minutes', botId: m.moderatorId };
  return { kind: 'none' };
}

const clip = (s: string, max: number) => s.trim().slice(0, max);

function statusAfter(m: TeamMeeting): MeetingStatus {
  const step = nextStep({ ...m, status: 'round1' });
  if (step.kind === 'answer') return step.round === 1 ? 'round1' : 'round2';
  return step.kind === 'minutes' ? 'minutes' : 'done';
}

export function applyAnswer(m: TeamMeeting, botId: string, round: MeetingRound, text: string, now: number): TeamMeeting {
  if (!m.participantIds.includes(botId) || answerOf(m, botId, round)) return m;
  const next = { ...m, answers: [...m.answers, { botId, round, text: clip(text, MEETING_LIMITS.answer), at: now }], updatedAt: now };
  return { ...next, status: statusAfter(next) };
}

export function applyMinutes(m: TeamMeeting, text: string, now: number): TeamMeeting {
  return { ...m, minutes: clip(text, MEETING_LIMITS.minutes), status: 'done', updatedAt: now };
}

export function failMeeting(m: TeamMeeting, error: string, now: number): TeamMeeting {
  return { ...m, status: 'failed', error: clip(error, MEETING_LIMITS.error), updatedAt: now };
}

// Round-1 text is sealed while the round is open: the client never receives it.
export function visibleMeeting(m: TeamMeeting): TeamMeeting {
  if (m.status !== 'round1') return m;
  return { ...m, answers: m.answers.map((a) => (a.round === 1 ? { ...a, text: '' } : a)) };
}

export function coerceMeeting(raw: unknown): TeamMeeting | null {
  const r = raw as Partial<TeamMeeting> | null;
  if (!r || typeof r.id !== 'string' || typeof r.question !== 'string' || typeof r.moderatorId !== 'string') return null;
  if (!Array.isArray(r.participantIds) || !Array.isArray(r.answers)) return null;
  if (!['round1', 'round2', 'minutes', 'done', 'failed'].includes(r.status as string)) return null;
  return r as TeamMeeting;
}

export type NameOf = (botId: string) => string;

export function round1Prompt(question: string): string {
  return [
    'Você está numa reunião de equipe para decidir algo importante. Esta é a RODADA 1, às cegas: você NÃO vê as respostas dos outros e eles não veem a sua.',
    `Pergunta: ${question}`,
    'Dê a sua posição própria, do ponto de vista do seu setor, em no máximo 8 linhas. Sem preâmbulo.',
    'Termine com uma única linha no formato "Recomendo: ...".',
  ].join('\n\n');
}

export function round2Prompt(question: string, own: string, others: { botId: string; text: string }[], nameOf: NameOf): string {
  const seen = others.map((o) => `${nameOf(o.botId)}:\n${o.text}`).join('\n\n');
  return [
    'RODADA 2 da reunião. Agora você vê as posições da rodada 1.',
    `Pergunta: ${question}`,
    `Sua posição na rodada 1:\n${own}`,
    `Posições dos outros:\n${seen}`,
    'Diga se mantém ou muda a sua posição e por quê, em no máximo 6 linhas. Sem preâmbulo.',
    'Termine com uma única linha no formato "Recomendo: ...".',
  ].join('\n\n');
}

export function minutesPrompt(question: string, answers: MeetingAnswer[], nameOf: NameOf): string {
  const block = (round: MeetingRound) => answers
    .filter((a) => a.round === round)
    .map((a) => `${nameOf(a.botId)}:\n${a.text}`)
    .join('\n\n');
  return [
    'Você é o moderador desta reunião. Escreva a ata para o humano que vai decidir.',
    `Pergunta: ${question}`,
    `Rodada 1 (às cegas):\n${block(1)}`,
    `Rodada 2 (depois de ver os outros):\n${block(2)}`,
    'A ata tem exatamente estas quatro seções, curtas, sem preâmbulo:',
    'Decisão recomendada\nOnde concordam\nOnde discordam\nO que o humano precisa decidir',
  ].join('\n\n');
}
