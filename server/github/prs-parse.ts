import { classifyRisk, taskFromBody, type PrCheckRun, type PrChecks, type PrComment, type PrDetail, type PrFile, type PrMergeable, type PrReview, type PrState, type PrSummary } from '../../shared/prs';

// Pure: GitHub GraphQL nodes in, hub shapes out. Kept apart from the `gh` runner
// so the mapping is tested on fixtures without a network.

const BASE_FIELDS = `
  url number title state isDraft createdAt updatedAt mergedAt headRefName baseRefName
  additions deletions changedFiles body author { login } repository { nameWithOwner }`;

// Open PRs need the live state (checks, mergeable, review) and the file list for
// the risk class. That rollup is what makes GitHub time out (502): 50 open PRs
// with files, or 100 merged ones with checks, both fail — so open pages stay at
// 20 and merged pages carry only the base fields.
const LIVE_FIELDS = `
  mergeable reviewDecision
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }`;

export const LIST_FIELDS = BASE_FIELDS + LIVE_FIELDS;

export type SearchMode = 'live' | 'history';
export const PAGE_SIZE: Record<SearchMode, number> = { live: 20, history: 100 };

export const SEARCH_QUERY = (mode: SearchMode) => `
query($q: String!, $first: Int!, $after: String) {
  search(query: $q, type: ISSUE, first: $first, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes { ... on PullRequest { ${mode === 'live' ? `${LIST_FIELDS} files(first: 100) { totalCount nodes { path } }` : BASE_FIELDS} } }
  }
}`;

export const DETAIL_QUERY = `
query($url: URI!) {
  resource(url: $url) { ... on PullRequest {
    ${LIST_FIELDS}
    files(first: 100) { totalCount nodes { path additions deletions changeType } }
    checks: commits(last: 1) { nodes { commit { statusCheckRollup { contexts(first: 60) { nodes {
      __typename
      ... on CheckRun { name status conclusion detailsUrl }
      ... on StatusContext { context state targetUrl }
    } } } } } }
    comments(last: 30) { nodes { author { login } body createdAt } }
    reviews(last: 20) { nodes { author { login } body state createdAt } }
  } }
}`;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function mapState(v: unknown): PrState {
  return v === 'MERGED' ? 'merged' : v === 'CLOSED' ? 'closed' : 'open';
}

export function mapChecks(v: unknown): PrChecks {
  if (v === 'SUCCESS') return 'success';
  if (v === 'FAILURE' || v === 'ERROR') return 'failure';
  if (v === 'PENDING' || v === 'EXPECTED') return 'pending';
  return 'none';
}

function mapReview(v: unknown): PrReview {
  if (v === 'APPROVED') return 'approved';
  if (v === 'CHANGES_REQUESTED') return 'changes';
  if (v === 'REVIEW_REQUIRED') return 'required';
  return 'none';
}

function mapMergeable(v: unknown): PrMergeable {
  return v === 'MERGEABLE' ? 'ok' : v === 'CONFLICTING' ? 'conflict' : 'unknown';
}

function rollupState(n: Obj): unknown {
  const last = obj(arr(obj(n.commits).nodes)[0]);
  return obj(obj(last.commit).statusCheckRollup).state;
}

export function prFromNode(raw: unknown, sessions?: ReadonlyMap<string, string>): PrSummary | null {
  const n = obj(raw);
  const url = str(n.url);
  if (!url) return null;
  const files = obj(n.files);
  const paths = arr(files.nodes).map((f) => str(obj(f).path)).filter(Boolean);
  const additions = num(n.additions);
  const deletions = num(n.deletions);
  const hasFiles = 'files' in n;
  const { risk, reasons } = hasFiles
    ? classifyRisk({ files: paths, filesTruncated: num(files.totalCount) > paths.length, additions, deletions })
    : { risk: 'safe' as const, reasons: [] };
  const body = str(n.body);
  return {
    url,
    number: num(n.number),
    title: str(n.title),
    repo: str(obj(n.repository).nameWithOwner),
    author: str(obj(n.author).login),
    state: mapState(n.state),
    isDraft: n.isDraft === true,
    createdAt: str(n.createdAt),
    updatedAt: str(n.updatedAt),
    mergedAt: str(n.mergedAt) || undefined,
    headRef: str(n.headRefName),
    baseRef: str(n.baseRefName),
    additions,
    deletions,
    changedFiles: num(n.changedFiles),
    checks: mapChecks(rollupState(n)),
    review: mapReview(n.reviewDecision),
    mergeable: mapMergeable(n.mergeable),
    risk,
    riskReasons: reasons,
    task: taskFromBody(body),
    sessionId: sessions?.get(url),
  };
}

export function searchPage(raw: unknown): { nodes: unknown[]; next: string | null } {
  const search = obj(obj(obj(raw).data).search);
  const info = obj(search.pageInfo);
  return { nodes: arr(search.nodes), next: info.hasNextPage === true && str(info.endCursor) ? str(info.endCursor) : null };
}

function mapChange(v: unknown): PrFile['change'] {
  if (v === 'ADDED') return 'added';
  if (v === 'DELETED') return 'deleted';
  if (v === 'RENAMED') return 'renamed';
  return 'modified';
}

export function checkRunFromNode(raw: unknown): PrCheckRun | null {
  const n = obj(raw);
  if (n.__typename === 'CheckRun') {
    const name = str(n.name);
    if (!name) return null;
    const c = n.conclusion;
    const state: PrCheckRun['state'] = n.status !== 'COMPLETED' ? 'pending'
      : c === 'SUCCESS' || c === 'NEUTRAL' ? 'success'
      : c === 'SKIPPED' ? 'skipped' : 'failure';
    return { name, state, url: str(n.detailsUrl) || undefined };
  }
  if (n.__typename === 'StatusContext') {
    const name = str(n.context);
    if (!name) return null;
    const s = mapChecks(n.state);
    return { name, state: s === 'none' ? 'pending' : s, url: str(n.targetUrl) || undefined };
  }
  return null;
}

const CHECK_ORDER: Record<PrCheckRun['state'], number> = { failure: 0, pending: 1, success: 2, skipped: 3 };

// Reusable workflows report the same job once per caller, so a PR lists dozens of
// identical "tier: skipped" rows; one per name+state is what anyone reads. Failures
// first — that is the reason the tab gets opened.
export function orderChecks(runs: PrCheckRun[]): PrCheckRun[] {
  const seen = new Set<string>();
  return runs
    .filter((r) => { const k = `${r.name}\u0000${r.state}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => CHECK_ORDER[a.state] - CHECK_ORDER[b.state]);
}

export function detailFromResource(raw: unknown, sessions?: ReadonlyMap<string, string>): PrDetail | null {
  const n = obj(obj(obj(raw).data).resource);
  const files = obj(n.files);
  const summary = prFromNode({ ...n, files: { totalCount: files.totalCount, nodes: arr(files.nodes) } }, sessions);
  if (!summary) return null;
  const fileList: PrFile[] = arr(files.nodes).map((f) => {
    const o = obj(f);
    return { path: str(o.path), additions: num(o.additions), deletions: num(o.deletions), change: mapChange(o.changeType) };
  }).filter((f) => f.path);
  const ctx = obj(obj(obj(obj(arr(obj(n.checks).nodes)[0]).commit).statusCheckRollup).contexts);
  const checkRuns = orderChecks(arr(ctx.nodes).map(checkRunFromNode).filter((c): c is PrCheckRun => c !== null));
  const comments: PrComment[] = [
    ...arr(obj(n.comments).nodes).map((c) => ({ c: obj(c), kind: 'comment' as const })),
    ...arr(obj(n.reviews).nodes).map((c) => ({ c: obj(c), kind: 'review' as const })),
  ]
    .filter(({ c, kind }) => str(c.body).trim() || (kind === 'review' && c.state !== 'COMMENTED'))
    .map(({ c, kind }) => ({
      author: str(obj(c.author).login) || 'ghost',
      body: str(c.body) || (c.state === 'APPROVED' ? '_aprovou_' : c.state === 'CHANGES_REQUESTED' ? '_pediu mudanças_' : ''),
      createdAt: str(c.createdAt),
      kind,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    ...summary,
    body: str(n.body),
    files: fileList,
    filesTruncated: num(files.totalCount) > fileList.length,
    checkRuns,
    comments,
  };
}
