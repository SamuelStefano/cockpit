import type { PrSummary } from '../../../shared/prs';

export type BadgeTone = 'neutral' | 'green' | 'red' | 'yellow';
export interface PrBadge { label: string; tone: BadgeTone }
export interface OrgGroup { org: string; total: number; repos: { repo: string; name: string; count: number }[] }
export interface DayGroup { key: string; label: string; prs: PrSummary[] }
export interface PrFilter { org: string | null; repo: string | null }

export const orgOf = (repo: string): string => repo.split('/')[0] ?? repo;
export const repoName = (repo: string): string => repo.split('/')[1] ?? repo;

export function groupByOrg(prs: PrSummary[]): OrgGroup[] {
  const orgs = new Map<string, Map<string, number>>();
  for (const pr of prs) {
    const repos = orgs.get(orgOf(pr.repo)) ?? new Map<string, number>();
    repos.set(pr.repo, (repos.get(pr.repo) ?? 0) + 1);
    orgs.set(orgOf(pr.repo), repos);
  }
  return [...orgs.entries()]
    .map(([org, repos]) => ({
      org,
      total: [...repos.values()].reduce((a, b) => a + b, 0),
      repos: [...repos.entries()]
        .map(([repo, count]) => ({ repo, name: repoName(repo), count }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.org.localeCompare(b.org));
}

export function filterPrs(prs: PrSummary[], f: PrFilter): PrSummary[] {
  if (f.repo) return prs.filter((p) => p.repo === f.repo);
  if (f.org) return prs.filter((p) => orgOf(p.repo) === f.org);
  return prs;
}

const dayKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function dayLabel(d: Date, now: Date): string {
  const key = dayKey(d);
  if (key === dayKey(now)) return 'Hoje';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === dayKey(yesterday)) return 'Ontem';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function groupMergedByDay(prs: PrSummary[], now: Date = new Date()): DayGroup[] {
  const stamp = (p: PrSummary): number => Date.parse(p.mergedAt ?? p.updatedAt) || 0;
  const groups = new Map<string, DayGroup>();
  for (const pr of [...prs].sort((a, b) => stamp(b) - stamp(a))) {
    const d = new Date(stamp(pr));
    const key = dayKey(d);
    const g = groups.get(key) ?? { key, label: dayLabel(d, now), prs: [] };
    g.prs.push(pr);
    groups.set(key, g);
  }
  return [...groups.values()];
}

export function prBadges(pr: PrSummary): PrBadge[] {
  const out: PrBadge[] = [];
  if (pr.state === 'merged') return pr.task ? [{ label: pr.task, tone: 'neutral' }] : [];
  if (pr.isDraft) out.push({ label: 'Rascunho', tone: 'neutral' });
  if (pr.checks === 'success') out.push({ label: 'CI ok', tone: 'green' });
  else if (pr.checks === 'failure') out.push({ label: 'CI falhou', tone: 'red' });
  else if (pr.checks === 'pending') out.push({ label: 'CI rodando', tone: 'yellow' });
  if (pr.review === 'approved') out.push({ label: 'Aprovada', tone: 'green' });
  else if (pr.review === 'changes') out.push({ label: 'Mudanças pedidas', tone: 'red' });
  if (pr.mergeable === 'conflict') out.push({ label: 'Conflito', tone: 'red' });
  if (pr.risk === 'safe') out.push({ label: 'Seguro', tone: 'green' });
  else if (pr.risk === 'maybe') out.push({ label: 'Talvez', tone: 'yellow' });
  else out.push({ label: 'Inseguro', tone: 'red' });
  if (pr.task) out.push({ label: pr.task, tone: 'neutral' });
  return out;
}

export function relativeTime(iso: string | number, now: number = Date.now()): string {
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const min = Math.max(0, Math.floor((now - t) / 60_000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

export function mergedCountLabel(count: number, days: number, truncated: boolean): string {
  return `${count}${truncated ? '+' : ''} mergeadas em ${days} dias`;
}
