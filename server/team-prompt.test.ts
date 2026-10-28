import { describe, it, expect } from 'vitest';
import { buildBotIdentity, findTurnBot, botTurnParams, botTurnFor } from './team-prompt';
import type { TeamBot } from '../shared/protocol';

const mk = (id: string, over: Partial<TeamBot> = {}): TeamBot => ({
  id, name: id, label: '', instructions: '', mascot: { shape: 'blob', color: '#22c55e' }, profile: 'full', createdAt: 0, updatedAt: 0, ...over,
});
const team = [mk('capo1', { label: 'coo do tainan', primary: true }), mk('lead1', { parentId: 'capo1', instructions: 'escolha a hipótese' }), mk('kid11', { parentId: 'lead1' })];
const SID = '11111111-1111-1111-1111-111111111111';

describe('buildBotIdentity', () => {
  it('names the bot, carries its instructions and the chain of command', () => {
    const t = buildBotIdentity(team[1], team);
    expect(t.startsWith('Você é lead1')).toBe(true);
    expect(t).toContain('escolha a hipótese');
    expect(t).toContain('- capo1 (principal) — coo do tainan; chefe de lead1');
    expect(t).toContain('- lead1; responde a capo1; chefe de kid11');
  });
  it('asks for decisions as AskUserQuestion with 2-4 options and images as workspace files', () => {
    const t = buildBotIdentity(team[0], team);
    expect(t).toContain('AskUserQuestion com uma pergunta e 2 a 4 opções curtas e mutuamente exclusivas');
    expect(t).toContain('![legenda](nome.png)');
  });
  it('tells the bot about the optional image and deadline of a proposal', () => {
    const t = buildBotIdentity(team[0], team);
    expect(t).toContain('`image`');
    expect(t).toContain('`deadline`');
  });
  it('omits the roster for a team of one and caps the size', () => {
    const solo = mk('solo1', { instructions: 'z'.repeat(40_000) });
    const t = buildBotIdentity(solo, [solo]);
    expect(t).not.toContain('A equipe');
    expect(new TextEncoder().encode(t).length).toBeLessThanOrEqual(16 * 1024);
  });
});

describe('findTurnBot / botTurnParams', () => {
  const bound = [mk('capo1', { sessionId: SID, effort: 'high' })];
  it('finds by key or by bound session', () => {
    expect(findTurnBot(bound, 'new-bot-capo1')?.id).toBe('capo1');
    expect(findTurnBot(bound, 'bot-capo1')?.id).toBe('capo1');
    expect(findTurnBot(bound, SID, SID)?.id).toBe('capo1');
    expect(findTurnBot(bound, 'k1', 'other')).toBeUndefined();
    expect(findTurnBot(bound, 'bot-ghost1')).toBeUndefined();
  });
  it('resumes the bound session and pins the bot settings', () => {
    expect(botTurnParams(bound, 'new-bot-capo1', undefined)).toMatchObject({ botId: 'capo1', resumeId: SID, effort: 'high' });
    expect(botTurnParams([mk('capo1')], 'new-bot-capo1', undefined)?.resumeId).toBeUndefined();
  });
});

describe('botTurnFor (fatia E)', () => {
  it('carries the stored profile for admin', () => {
    expect(botTurnFor([mk('capo1', { profile: 'full' })], 'new-bot-capo1', undefined, 'admin')?.profile).toBe('full');
    expect(botTurnFor([mk('capo1', { profile: 'restricted' })], 'new-bot-capo1', undefined, 'admin')?.profile).toBe('restricted');
  });
  it('forces restricted for a student or an unknown role', () => {
    expect(botTurnFor([mk('capo1', { profile: 'full' })], 'new-bot-capo1', undefined, 'student')?.profile).toBe('restricted');
    expect(botTurnFor([mk('capo1', { profile: 'full' })], 'new-bot-capo1', undefined, undefined)?.profile).toBe('restricted');
  });
  it('a stored profile that is neither value reads as restricted', () => {
    const odd = mk('capo1', { profile: 'weird' as never });
    expect(botTurnParams([odd], 'new-bot-capo1', undefined)?.profile).toBe('restricted');
  });
  it('no bot, no turn', () => {
    expect(botTurnFor([], 'k1', undefined, 'student')).toBeUndefined();
  });
});

describe('bot access on the turn', () => {
  it('a bot without the fields produces the same turn as before', () => {
    const t = botTurnParams(team, 'bot-lead1');
    expect(t).not.toHaveProperty('skills');
    expect(t).not.toHaveProperty('permissions');
  });
  it('carries skills and permissions through', () => {
    const t = botTurnParams([mk('lead1', { skills: ['a'], permissions: { read: true, write: false, net: true } })], 'bot-lead1');
    expect(t).toMatchObject({ skills: ['a'], permissions: { write: false } });
  });
  it('a non-admin turn can never regain write', () => {
    const t = botTurnFor([mk('lead1', { permissions: { read: true, write: true, net: true } })], 'bot-lead1', undefined, 'student');
    expect(t?.permissions?.write).toBe(false);
    expect(t?.profile).toBe('restricted');
  });
});
