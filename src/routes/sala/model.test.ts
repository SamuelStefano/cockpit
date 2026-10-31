import { describe, expect, it } from 'vitest';
import { buildSala, SALA_CENTER, type SalaBot, type SalaSession } from './model';

const lead: SalaBot = {
  id: 'lead', name: 'Orquestrador', label: 'Orquestrador', color: '#eab308', primary: true, sessionId: 's-lead',
};
const eng: SalaBot = {
  id: 'eng', name: 'grok-engineer', label: 'Engineer', color: '#14b8a6', parentId: 'lead', sessionId: 's-eng',
};

function session(over: Partial<SalaSession> & Pick<SalaSession, 'id'>): SalaSession {
  return { title: over.id, snippet: '', mtime: 1_000, ...over };
}

describe('buildSala', () => {
  it('puts the primary bot in the center and a child on the inner ring', () => {
    const map = buildSala({
      bots: [lead, eng],
      sessions: [session({ id: 's-lead', snippet: 'no centro' }), session({ id: 's-eng' })],
      running: new Set(['s-eng']),
      now: 2_000,
    });
    const center = map.nodes.find((n) => n.id === 'bot:lead');
    const child = map.nodes.find((n) => n.id === 'bot:eng');
    expect(center).toMatchObject({ x: SALA_CENTER.x, y: SALA_CENTER.y, pulse: 'idle', detail: 'no centro' });
    expect(child?.pulse).toBe('working');
    expect(Math.hypot((child?.x ?? 0) - SALA_CENTER.x, (child?.y ?? 0) - SALA_CENTER.y)).toBeGreaterThan(150);
    expect(map.edges).toContainEqual({ from: 'bot:lead', to: 'bot:eng', live: true });
    expect(map.nodes.filter((n) => n.sessionId === 's-eng')).toHaveLength(1);
  });

  it('shows a live chat that is not a bot, and skips an old quiet one', () => {
    const map = buildSala({
      bots: [lead],
      sessions: [
        session({ id: 's-lead' }),
        session({ id: 'live', title: 'prompt grande', mtime: 500 }),
        session({ id: 'old', title: 'arquivo', mtime: 500 }),
      ],
      running: new Set(['live']),
      now: 50 * 60 * 1000,
    });
    expect(map.nodes.map((n) => n.id)).toEqual(['bot:lead', 'chat:live']);
    expect(map.edges).toContainEqual({ from: 'bot:lead', to: 'chat:live', live: true });
    expect(map.working).toBe(1);
  });

  it('keeps at most eight extra chats, running first', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => session({ id: `c${i}`, mtime: i, title: `t${i}` }));
    const map = buildSala({
      bots: [lead],
      sessions,
      running: new Set(['c9']),
      now: 1_000,
    });
    const chats = map.nodes.filter((n) => n.kind === 'chat');
    expect(chats).toHaveLength(8);
    expect(chats[0]?.sessionId).toBe('c9');
  });

  it('marks a session that is waiting on the person', () => {
    const map = buildSala({
      bots: [lead],
      sessions: [session({ id: 'ask', waiting: true, mtime: 10 })],
      running: new Set(),
      now: 10,
    });
    expect(map.nodes.find((n) => n.id === 'chat:ask')?.pulse).toBe('waiting');
    expect(map.waiting).toBe(1);
  });
});
