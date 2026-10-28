import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDeckContext, deckAgentContext, joinSystemPrompts, loadRoster, parseRoster, saveRoster, type DeckContextInput } from './deck-context';

const base: DeckContextInput = {
  label: 'pc-samuel', host: 'DESKTOP-1', roster: null, deckctl: false, deckGuide: false, bot: false,
  home: '/home/u', workdir: '/home/u',
};

describe('buildDeckContext', () => {
  it('names the box, the host and the context files of this box', () => {
    const t = buildDeckContext(base);
    expect(t).toContain('Box: pc-samuel (hostname DESKTOP-1)');
    expect(t).toContain('/home/u/.claude/CLAUDE.md');
    expect(t).toContain('/home/u/.claude/projects/-home-u/memory/');
    expect(t).toContain('Other boxes: unknown');
    expect(t).toContain('`deckctl` is not installed');
    expect(t).not.toContain('deck-guide');
  });

  it('lists the other boxes with their status, never this one', () => {
    const roster = { at: Date.UTC(2026, 9, 27, 12, 0), boxes: [
      { label: 'pc-samuel', online: true, self: true },
      { label: 'vps', online: true, self: false },
      { label: 'laptop', online: false, self: false },
    ] };
    const t = buildDeckContext({ ...base, roster });
    expect(t).toContain('2026-10-27 12:00 UTC');
    expect(t).toContain('  - vps (online)');
    expect(t).toContain('  - laptop (offline)');
    expect(t).not.toContain('  - pc-samuel');
    expect(buildDeckContext({ ...base, roster: { at: 0, boxes: [roster.boxes[0]] } })).toContain('the only box');
  });

  it('describes the tools this box and turn actually have', () => {
    const t = buildDeckContext({ ...base, deckctl: true, deckGuide: true, bot: true });
    expect(t).toContain('`deckctl` is installed');
    expect(t).toContain('You are an Equipe bot');
    expect(t).toContain('`deck-guide` skill');
  });

  it('stays short', () => {
    const many = { at: 0, boxes: Array.from({ length: 10 }, (_, i) => ({ label: `b${i}`, online: true, self: i === 0 })) };
    expect(buildDeckContext({ ...base, roster: many, deckctl: true, deckGuide: true }).split('\n').length).toBeLessThanOrEqual(60);
  });
});

describe('roster', () => {
  let dir: string | undefined;
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = undefined; });

  it('sanitizes labels and drops junk', () => {
    expect(parseRoster('x')).toBeNull();
    expect(parseRoster([{ label: 'a‮b', online: 'yes', self: true }, { label: '' }, null])).toEqual([{ label: 'a b', online: false, self: true }]);
  });

  it('round-trips through a 0600 file', () => {
    dir = mkdtempSync(join(tmpdir(), 'roster-'));
    const file = join(dir, 'sub', 'box-roster.json');
    saveRoster([{ label: 'vps', online: true, self: false }], 42, file);
    expect(loadRoster(file)).toEqual({ at: 42, boxes: [{ label: 'vps', online: true, self: false }] });
    expect(statSync(file).mode & 0o777).toBe(0o600);
    saveRoster([{ label: 'vps', online: true, self: false }], 99, file);
    expect(loadRoster(file)?.at).toBe(42);
  });

  it('the self entry gives the label the Deck shows', () => {
    dir = mkdtempSync(join(tmpdir(), 'roster-'));
    const file = join(dir, 'box-roster.json');
    saveRoster([{ label: 'Meu PC', online: true, self: true }], 1, file);
    expect(deckAgentContext({ bot: false }, { DECK_BOX_ROSTER_FILE: file, DECK_BOX_LABEL: 'host-label' })).toContain('Box: Meu PC');
    expect(deckAgentContext({ bot: false }, { DECK_BOX_ROSTER_FILE: file, DECK_AGENT_CONTEXT: '0' })).toBeUndefined();
  });
});

describe('joinSystemPrompts', () => {
  it('skips empty parts', () => {
    expect(joinSystemPrompts(undefined, ' ')).toBeUndefined();
    expect(joinSystemPrompts('a', undefined, 'b')).toBe('a\n\nb');
  });
});
