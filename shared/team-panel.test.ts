import { describe, expect, it } from 'vitest';
import type { PrSummary, PrsSnapshot } from './prs';
import type { TeamBot } from './protocol';
import type { TeamState } from './team-state';
import { assignPrToBot, buildTeamPanel, panelFor, prBlocker, redactTeamPanel } from './team-panel';

const NOW = Date.parse('2026-11-17T12:00:00Z');
const team = [{ id: 'ana1', sessionId: 'sess-a' }, { id: 'bob2' }] as unknown as TeamBot[];
const pr = (o: Partial<PrSummary>): PrSummary => ({
  url: 'https://github.com/o/r/pull/1', number: 1, title: 'SECRET title', repo: 'o/secret-repo', author: 'x', state: 'open', isDraft: false,
  createdAt: '', updatedAt: '', headRef: 'feat/secret-branch', baseRef: 'main', additions: 0, deletions: 0, changedFiles: 0,
  checks: 'success', review: 'none', mergeable: 'ok', risk: 'safe', riskReasons: [], ...o,
});
const state: TeamState = {
  at: NOW, followUpHours: 4, handoffs: [], followUps: [],
  bots: [
    { id: 'ana1', name: 'Ana', role: 'dev', sector: 'engineering', status: 'working', task: 'SECRET task' },
    { id: 'bob2', name: 'Bob', role: 'ops', status: 'waiting' },
  ],
};
const snap = (mine: PrSummary[], merged: PrSummary[] = []): PrsSnapshot =>
  ({ fetchedAt: NOW, mine, merged, review: [], mergedSinceDays: 30, mergedTruncated: false });
const question = { botId: 'bob2', sessionKey: 'k', at: 5, questions: [{ question: 'SECRET question?', header: 'h', multiSelect: false, options: [] }] };

describe('assignPrToBot', () => {
  it('prefers the session link', () => {
    expect(assignPrToBot(pr({ sessionId: 'sess-a', headRef: 'bob2/x' }), team)).toBe('ana1');
  });
  it('matches a whole token in branch, then title', () => {
    expect(assignPrToBot(pr({ headRef: 'feat/bob2-login' }), team)).toBe('bob2');
    expect(assignPrToBot(pr({ title: 'fix by ana1: thing' }), team)).toBe('ana1');
  });
  it('does not match a substring', () => {
    expect(assignPrToBot(pr({ headRef: 'feat/bob22', title: 'xana1y' }), team)).toBeNull();
  });
});

describe('prBlocker', () => {
  it('derives conflict, checks, changes; none for merged or clean', () => {
    expect(prBlocker(pr({ mergeable: 'conflict' }))).toBe('conflict');
    expect(prBlocker(pr({ checks: 'failure' }))).toBe('checks');
    expect(prBlocker(pr({ review: 'changes' }))).toBe('changes');
    expect(prBlocker(pr({ state: 'merged', checks: 'failure' }))).toBeNull();
    expect(prBlocker(pr({}))).toBeNull();
  });
});

describe('buildTeamPanel', () => {
  const old = pr({ url: 'u-old', state: 'merged', mergedAt: '2026-11-01T00:00:00Z' });
  const recent = pr({ url: 'u-new', state: 'merged', mergedAt: '2026-11-15T00:00:00Z', headRef: 'ana1/x' });
  const input = {
    team, state, now: NOW, pending: [question],
    prs: snap([pr({ url: 'u1', headRef: 'ana1/x', checks: 'failure' }), pr({ url: 'u2', mergeable: 'conflict' })], [old, recent]),
  };
  const panel = buildTeamPanel(input);

  it('groups per sector, keeps only 7-day merges, and files orphans under Sem dono', () => {
    const eng = panel.sectors.find((s) => s.id === 'engineering')!;
    expect(eng.bots[0].openPrs.map((p) => p.url)).toEqual(['u1']);
    expect(eng.bots[0].mergedPrs.map((p) => p.url)).toEqual(['u-new']);
    const orphan = panel.sectors.find((s) => s.name === 'Sem dono')!;
    expect(orphan.openPrs.map((p) => p.url)).toEqual(['u2']);
  });
  it('collects questions and blockers under needs-you without duplicating a waiting bot', () => {
    expect(panel.needsYou.filter((n) => n.kind === 'question')).toHaveLength(1);
    expect(panel.needsYou.filter((n) => n.kind === 'blocker')).toHaveLength(2);
    expect(buildTeamPanel({ ...input, pending: [] }).needsYou.some((n) => n.text === 'Waiting for an answer')).toBe(true);
  });
});

describe('redaction', () => {
  const panel = buildTeamPanel({
    team, state, now: NOW, pending: [question],
    prs: snap([pr({ url: 'u1', headRef: 'ana1/x', checks: 'failure' })]),
  });
  it('keeps only names, statuses and counts', () => {
    const json = JSON.stringify(redactTeamPanel(panel));
    for (const forbidden of ['SECRET', 'secret-repo', 'secret-branch', 'u1', 'github', 'ana1', 'task', 'title', 'repo', 'branch', 'question']) {
      expect(json).not.toContain(forbidden);
    }
    expect(json).toContain('Ana');
    expect(redactTeamPanel(panel).sectors[0].bots[0]).toMatchObject({ openPrs: 1, blockers: 1 });
  });
  it('panelFor switches on the flag', () => {
    expect(panelFor(panel, true).redacted).toBe(true);
    expect(panelFor(panel, false).redacted).toBe(false);
  });
});
