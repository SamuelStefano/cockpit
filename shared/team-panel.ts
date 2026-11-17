import type { PrSummary, PrsSnapshot } from './prs';
import type { TeamBot, TeamMascot, TeamPendingQuestion } from './protocol';
import type { TeamBotStatus, TeamState } from './team-state';
import { DEPARTMENTS, type DepartmentId } from './departments';

const BRT_OFFSET_MS = -3 * 3_600_000;
export const UNOWNED_SECTOR_ID = 'unowned';
const DAY_MS = 86_400_000;

export const startOfBrtDay = (now: number): number =>
  Math.floor((now + BRT_OFFSET_MS) / DAY_MS) * DAY_MS - BRT_OFFSET_MS;

export type PrBlocker = 'checks' | 'conflict' | 'changes';

export interface TeamPanelPr {
  url: string;
  number: number;
  title: string;
  repo: string;
  branch: string;
  state: 'open' | 'merged';
  mergedAt?: string;
  updatedAt?: number;
  blocker?: PrBlocker;
}

export interface TeamPanelNeed {
  kind: 'question' | 'blocker';
  botId?: string;
  botName: string;
  text: string;
  at?: number;
  prUrl?: string;
}

export interface TeamPanelBot {
  id: string;
  name: string;
  status: TeamBotStatus;
  mascot?: TeamMascot;
  task?: string;
  openPrs: TeamPanelPr[];
  mergedPrs: TeamPanelPr[];
  needs: TeamPanelNeed[];
}

export interface TeamPanelSector {
  id: DepartmentId | typeof UNOWNED_SECTOR_ID | 'none';
  name: string;
  bots: TeamPanelBot[];
  openPrs: TeamPanelPr[];
  mergedPrs: TeamPanelPr[];
}

export interface TeamPanel {
  redacted: false;
  at: number;
  prsFetchedAt?: number;
  prsError?: string;
  needsYou: TeamPanelNeed[];
  sectors: TeamPanelSector[];
}

export interface RedactedNeed { botName: string; at?: number }

export interface RedactedBot {
  name: string;
  status: TeamBotStatus;
  mascot?: TeamMascot;
  openPrs: number;
  mergedPrs: number;
  blockers: number;
  needsYou: number;
}

export interface RedactedSector { name: string; bots: RedactedBot[]; unassignedPrs: number; openPrs: number; mergedPrs: number; blockers: number }

export interface RedactedTeamPanel {
  redacted: true;
  at: number;
  needsYou: number;
  needs: RedactedNeed[];
  sectors: RedactedSector[];
}

export type TeamPanelPayload = TeamPanel | RedactedTeamPanel;

const tokens = (s: string): Set<string> => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));

export function assignPrToBot(pr: Pick<PrSummary, 'sessionId' | 'headRef' | 'title'>, team: Pick<TeamBot, 'id' | 'sessionId'>[]): string | null {
  if (pr.sessionId) {
    const bySession = team.find((b) => b.sessionId && b.sessionId === pr.sessionId);
    if (bySession) return bySession.id;
  }
  const branch = tokens(pr.headRef);
  const byBranch = team.find((b) => branch.has(b.id.toLowerCase()));
  if (byBranch) return byBranch.id;
  const title = tokens(pr.title);
  return team.find((b) => title.has(b.id.toLowerCase()))?.id ?? null;
}

export function prBlocker(pr: Pick<PrSummary, 'state' | 'checks' | 'mergeable' | 'review'>): PrBlocker | null {
  if (pr.state !== 'open') return null;
  if (pr.mergeable === 'conflict') return 'conflict';
  if (pr.checks === 'failure') return 'checks';
  if (pr.review === 'changes') return 'changes';
  return null;
}

const BLOCKER_TEXT: Record<PrBlocker, string> = {
  checks: 'Checks failing',
  conflict: 'Merge conflict',
  changes: 'Changes requested',
};

function slim(pr: PrSummary): TeamPanelPr {
  const blocker = prBlocker(pr);
  return {
    url: pr.url, number: pr.number, title: pr.title, repo: pr.repo, branch: pr.headRef,
    state: pr.state === 'merged' ? 'merged' : 'open',
    ...(pr.mergedAt ? { mergedAt: pr.mergedAt } : {}),
    ...(blocker ? { blocker } : {}),
    ...(Date.parse(pr.updatedAt) ? { updatedAt: Date.parse(pr.updatedAt) } : {}),
  };
}

const needOf = (pr: TeamPanelPr, bot?: { id: string; name: string }, at?: number): TeamPanelNeed => ({
  kind: 'blocker', ...(at ? { at } : {}), botName: bot?.name ?? 'Sem dono', ...(bot ? { botId: bot.id } : {}),
  text: `${BLOCKER_TEXT[pr.blocker!]}: ${pr.repo}#${pr.number} ${pr.title}`, prUrl: pr.url,
});

export interface TeamPanelInput {
  team: TeamBot[];
  state: TeamState;
  prs: PrsSnapshot | null;
  pending: TeamPendingQuestion[];
  now: number;
}

export function buildTeamPanel(i: TeamPanelInput): TeamPanel {
  const since = startOfBrtDay(i.now);
  const seen = new Set<string>();
  const open: PrSummary[] = [];
  const merged: PrSummary[] = [];
  for (const pr of i.prs?.mine ?? []) if (!seen.has(pr.url) && pr.state === 'open') { seen.add(pr.url); open.push(pr); }
  for (const pr of i.prs?.merged ?? []) {
    const at = pr.mergedAt ? Date.parse(pr.mergedAt) : NaN;
    if (!seen.has(pr.url) && Number.isFinite(at) && at >= since) { seen.add(pr.url); merged.push(pr); }
  }

  const byBot = new Map<string, { open: TeamPanelPr[]; merged: TeamPanelPr[] }>();
  const orphanOpen: TeamPanelPr[] = [];
  const orphanMerged: TeamPanelPr[] = [];
  const place = (pr: PrSummary, kind: 'open' | 'merged') => {
    const id = assignPrToBot(pr, i.team);
    const s = slim(pr);
    if (!id) { (kind === 'open' ? orphanOpen : orphanMerged).push(s); return; }
    const e = byBot.get(id) ?? { open: [], merged: [] };
    e[kind].push(s);
    byBot.set(id, e);
  };
  open.forEach((p) => place(p, 'open'));
  merged.forEach((p) => place(p, 'merged'));

  const questionsOf = new Map<string, TeamPanelNeed[]>();
  const mascotOf = new Map(i.team.map((t) => [t.id, t.mascot]));
  const nameOf = new Map(i.state.bots.map((b) => [b.id, b.name]));
  for (const q of i.pending) {
    const list = questionsOf.get(q.botId) ?? [];
    list.push({ kind: 'question', botId: q.botId, botName: nameOf.get(q.botId) ?? q.botId, text: q.questions[0]?.question ?? '', at: q.at });
    questionsOf.set(q.botId, list);
  }

  const bots: (TeamPanelBot & { sector?: DepartmentId })[] = i.state.bots.map((b) => {
    const prs = byBot.get(b.id) ?? { open: [], merged: [] };
    const needs: TeamPanelNeed[] = [
      ...(questionsOf.get(b.id) ?? []),
      ...prs.open.filter((p) => p.blocker).map((p) => needOf(p, b, p.updatedAt)),
    ];
    if (b.status === 'waiting' && !questionsOf.has(b.id)) {
      needs.push({ kind: 'blocker', botId: b.id, botName: b.name, text: 'Waiting for an answer' });
    }
    return {
      id: b.id, name: b.name, status: b.status, ...(mascotOf.has(b.id) ? { mascot: mascotOf.get(b.id) } : {}), ...(b.task ? { task: b.task } : {}),
      openPrs: prs.open, mergedPrs: prs.merged, needs, ...(b.sector ? { sector: b.sector } : {}),
    };
  });

  const strip = ({ sector: _s, ...rest }: TeamPanelBot & { sector?: DepartmentId }): TeamPanelBot => rest;
  const sectors: TeamPanelSector[] = DEPARTMENTS.map((d) => ({
    id: d.id, name: d.name, bots: bots.filter((b) => b.sector === d.id).map(strip), openPrs: [], mergedPrs: [],
  })).filter((s) => s.bots.length > 0);
  const loose = bots.filter((b) => !b.sector);
  if (loose.length) sectors.push({ id: 'none', name: 'No sector', bots: loose.map(strip), openPrs: [], mergedPrs: [] });
  const unownedNeeds = orphanOpen.filter((p) => p.blocker).map((p) => needOf(p, undefined, p.updatedAt));
  if (orphanOpen.length || orphanMerged.length) {
    sectors.push({ id: UNOWNED_SECTOR_ID, name: 'Sem dono', bots: [], openPrs: orphanOpen, mergedPrs: orphanMerged });
  }

  const needsYou = [...sectors.flatMap((s) => s.bots.flatMap((b) => b.needs)), ...unownedNeeds]
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  return {
    redacted: false, at: i.now, needsYou, sectors,
    ...(i.prs ? { prsFetchedAt: i.prs.fetchedAt } : {}),
    ...(i.prs?.error ? { prsError: i.prs.error } : {}),
  };
}

export function redactTeamPanel(p: TeamPanel): RedactedTeamPanel {
  return {
    redacted: true,
    at: p.at,
    needsYou: p.needsYou.length,
    needs: p.needsYou.map((n) => ({ botName: n.botName, ...(n.at ? { at: n.at } : {}) })),
    sectors: p.sectors.map((s) => ({
      name: s.name,
      unassignedPrs: s.openPrs.length + s.mergedPrs.length,
      openPrs: s.openPrs.length + s.bots.reduce((n, b) => n + b.openPrs.length, 0),
      mergedPrs: s.mergedPrs.length + s.bots.reduce((n, b) => n + b.mergedPrs.length, 0),
      blockers: s.bots.reduce((n, b) => n + b.needs.filter((x) => x.kind === 'blocker').length, 0),
      bots: s.bots.map((b) => ({
        name: b.name,
        status: b.status,
        ...(b.mascot ? { mascot: b.mascot } : {}),
        openPrs: b.openPrs.length,
        mergedPrs: b.mergedPrs.length,
        blockers: b.needs.filter((n) => n.kind === 'blocker').length,
        needsYou: b.needs.filter((n) => n.kind === 'question').length,
      })),
    })),
  };
}

export function panelFor(p: TeamPanel, recording: boolean): TeamPanelPayload {
  return recording ? redactTeamPanel(p) : p;
}
