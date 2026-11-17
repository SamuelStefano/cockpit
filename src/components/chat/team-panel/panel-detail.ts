import type { TeamPanelBot, TeamPanelNeed, TeamPanelPr } from '../../../../shared/team-panel';

export interface PanelDetail { title: string; tag?: string; lines: string[]; link?: string }

const BLOCKER: Record<NonNullable<TeamPanelPr['blocker']>, string> = {
  checks: 'checks failing', conflict: 'merge conflict', changes: 'changes requested',
};

export const prLine = (p: TeamPanelPr): string =>
  `${p.repo}#${p.number} ${p.title}${p.blocker ? ` (${BLOCKER[p.blocker]})` : ''}`;

export function needDetail(n: TeamPanelNeed): PanelDetail {
  return { title: n.kind === 'question' ? `${n.botName} asks` : `${n.botName} is blocked`, tag: n.kind, lines: [n.text], link: n.prUrl };
}

export function botDetail(b: TeamPanelBot): PanelDetail {
  return {
    title: b.name,
    tag: b.status,
    lines: [
      ...(b.task ? [`Task: ${b.task}`] : []),
      ...b.openPrs.map((p) => `Open: ${prLine(p)}`),
      ...b.mergedPrs.map((p) => `Merged: ${prLine(p)}`),
      ...b.needs.map((n) => `Needs you: ${n.text}`),
    ],
  };
}

export function prDetail(p: TeamPanelPr): PanelDetail {
  return { title: p.title, tag: `${p.repo}#${p.number} · ${p.state}`, lines: [`Branch: ${p.branch}`, ...(p.blocker ? [`Blocker: ${BLOCKER[p.blocker]}`] : [])], link: p.url };
}
