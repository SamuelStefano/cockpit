import { describe, it, expect } from 'vitest';
import { botAliases } from './bot-alias';

const SID = '6ef8f243-a5aa-4082-bb40-29b66e7fa756';

describe('botAliases', () => {
  it('points a bound bot at its session', () => {
    expect(botAliases([{ id: 'capo1', sessionId: SID }], {})).toEqual({ 'bot-capo1': SID });
  });

  it('points an unbound bot at its draft, or where the draft already migrated', () => {
    expect(botAliases([{ id: 'capo1' }], {})).toEqual({ 'bot-capo1': 'new-bot-capo1' });
    expect(botAliases([{ id: 'capo1' }], { 'new-bot-capo1': SID })).toEqual({ 'bot-capo1': SID });
  });
});
