import type { TeamBot } from '../../../../shared/protocol';
import { newMeeting, type TeamMeeting } from '../../../../shared/team-meeting';

export const bot = (id: string, name: string, over: Partial<TeamBot> = {}): TeamBot => ({
  id, name, label: `${name} role`, instructions: '', mascot: { shape: 'drop', color: '#22c55e' }, profile: 'restricted', createdAt: 0, updatedAt: 0, ...over,
});

export const bots = [
  bot('a1', 'Ana', { department: 'engineering' }),
  bot('b2', 'Beto', { department: 'growth', primary: true }),
  bot('c3', 'Caio', { department: 'growth' }),
  bot('g7', 'Grok', { model: 'agent:grok' }),
];

export const meeting = (over: Partial<TeamMeeting> = {}): TeamMeeting => ({
  ...newMeeting('m1', { question: 'Migrar o banco?', participantIds: ['a1', 'b2'], moderatorId: 'c3' }, 10), ...over,
});
