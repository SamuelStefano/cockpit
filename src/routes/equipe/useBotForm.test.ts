import { describe, it, expect } from 'vitest';
import { draftFrom, draftError, toInput } from './useBotForm';
import type { TeamBot } from '../../../shared/protocol';

const mk = (id: string, over: Partial<TeamBot> = {}): TeamBot => ({
  id, name: id, label: '', instructions: '', mascot: { shape: 'blob', color: '#22c55e' }, profile: 'full', createdAt: 0, updatedAt: 0, ...over,
});

describe('bot form model', () => {
  it('a first bot starts as primary; later ones do not', () => {
    expect(draftFrom(null, 0).primary).toBe(true);
    expect(draftFrom(null, 2).primary).toBe(false);
  });
  it('round-trips an existing bot and drops empty optionals', () => {
    const bot = mk('capo1', { label: 'coo', parentId: 'lead1', model: 'agent:grok', primary: true });
    expect(toInput('capo1', draftFrom(bot, 1))).toEqual({ id: 'capo1', name: 'capo1', label: 'coo', instructions: '', mascot: bot.mascot, profile: 'full', parentId: 'lead1', model: 'agent:grok', primary: true });
    expect(toInput('x1234', draftFrom(null, 1))).not.toHaveProperty('model');
  });
  it('reports the first problem in Portuguese', () => {
    const bots = [mk('capo1'), mk('lead1', { parentId: 'capo1' })];
    expect(draftError('newb1', draftFrom(null, 2), bots)).toMatch(/nome inválido/);
    expect(draftError('newb1', { ...draftFrom(null, 2), name: 'CAPO1' }, bots)).toBe('já existe um bot com esse nome');
    expect(draftError('capo1', { ...draftFrom(bots[0], 2), parentId: 'lead1' }, bots)).toBe('essa chefia formaria um ciclo');
    expect(draftError('newb1', { ...draftFrom(null, 2), name: 'growth' }, bots)).toBeNull();
  });
});

describe('withLabel', () => {
  it('edits the label and strips server-owned fields', async () => {
    const { withLabel } = await import('./useBotForm');
    const out = withLabel(mk('capo1', { sessionId: 's', label: 'old' }), '  coo ');
    expect(out.label).toBe('coo');
    expect(out).not.toHaveProperty('sessionId');
    expect(out).not.toHaveProperty('createdAt');
  });
});
