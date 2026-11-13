// Pull requests hub: the owner's PRs across every org the box's `gh` can see.
// Pure, no node:* import — the server builds these, the client renders them.

export type PrState = 'open' | 'merged' | 'closed';
export type PrChecks = 'success' | 'failure' | 'pending' | 'none';
export type PrReview = 'approved' | 'changes' | 'required' | 'none';
export type PrMergeable = 'ok' | 'conflict' | 'unknown';
// Same three classes as the merge rule in CLAUDE.md: safe merges after one
// review, maybe needs a second look, unsafe never merges without approval.
export type PrRisk = 'safe' | 'maybe' | 'unsafe';
export type PrList = 'mine' | 'merged' | 'review';

export interface PrSummary {
  url: string;
  number: number;
  title: string;
  repo: string; // owner/name
  author: string;
  state: PrState;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  headRef: string;
  baseRef: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  checks: PrChecks;
  review: PrReview;
  mergeable: PrMergeable;
  risk: PrRisk;
  riskReasons: string[];
  task?: string; // DFL-123 from the body
  sessionId?: string; // the Deck chat that opened it (pr-link record)
}

export interface PrFile { path: string; additions: number; deletions: number; change: 'added' | 'deleted' | 'modified' | 'renamed' }
export interface PrCheckRun { name: string; state: 'success' | 'failure' | 'pending' | 'skipped'; url?: string }
export interface PrComment { author: string; body: string; createdAt: string; path?: string; kind: 'comment' | 'review' }

export interface PrThreadComment { author: string; body: string; createdAt: string }
// An inline review thread: anchored to a line of the head side when GitHub still
// knows it (`line`), file-level otherwise.
export interface PrReviewThread { path: string; line?: number; resolved: boolean; outdated: boolean; comments: PrThreadComment[] }

export interface PrDetail extends PrSummary {
  body: string;
  files: PrFile[];
  filesTruncated: boolean;
  checkRuns: PrCheckRun[];
  comments: PrComment[];
  threads: PrReviewThread[];
}

// The code of a PR. `patch` is GitHub's unified hunks for one file (no file
// header); it is absent for binaries and for files GitHub refuses to diff, and cut
// (`patchTruncated`) when one file alone would blow the frame.
export interface PrDiffFile {
  path: string;
  previousPath?: string;
  change: PrFile['change'];
  additions: number;
  deletions: number;
  patch?: string;
  patchTruncated?: boolean;
}

export interface PrDiff {
  url: string;
  files: PrDiffFile[];
  totalFiles: number;
  // Some files were left out (page cap or byte budget): the list is partial.
  truncated: boolean;
}

// The PRs of one chat: the ones it opened (pr-link records) and the ones that only
// show up in its transcript. `prs` comes only on a hydrated answer; the URL lists
// alone are enough for the count on the header button.
export interface SessionPrs {
  sessionId: string;
  createdUrls: string[];
  mentionedUrls: string[];
  prs?: PrSummary[];
  error?: string;
}

export interface PrsSnapshot {
  fetchedAt: number;
  mine: PrSummary[];
  merged: PrSummary[];
  review: PrSummary[];
  mergedSinceDays: number;
  // The merged list hit the page cap: the count on screen is a floor, not a total.
  mergedTruncated: boolean;
  error?: string;
}

export interface PrRiskInput { files: string[]; filesTruncated: boolean; additions: number; deletions: number }

const UNSAFE: [RegExp, string][] = [
  [/(^|\/)migrations?\//i, 'migration'],
  [/\.sql$/i, 'SQL'],
  [/(^|[/_.-])(rls|polic(y|ies))([/_.-]|$)/i, 'RLS'],
  [/(payment|invoice|billing|stripe|woovi|pix|payout|refund|ledger|spedy|nfse)/i, 'financeiro'],
];

const MAYBE: [RegExp, string][] = [
  [/(^|\/)supabase\/functions\//, 'edge function'],
  [/(^|\/)\.github\/workflows\//, 'CI'],
  [/(^|\/)(auth|jwt|session|token|secret)s?([/_.-]|$)/i, 'auth'],
  [/(^|\/)(\.env|env\.)/i, 'env'],
  [/(^|\/)(Dockerfile|docker-compose|deploy|infra|terraform)/i, 'infra'],
  [/(^|\/)package(-lock)?\.json$|pnpm-lock\.yaml$|bun\.lockb?$/, 'dependências'],
];

const BIG_DIFF = 800;

export function classifyRisk(input: PrRiskInput): { risk: PrRisk; reasons: string[] } {
  const unsafe = new Set<string>();
  const maybe = new Set<string>();
  for (const f of input.files) {
    for (const [re, label] of UNSAFE) if (re.test(f)) unsafe.add(label);
    for (const [re, label] of MAYBE) if (re.test(f)) maybe.add(label);
  }
  if (input.additions + input.deletions > BIG_DIFF) maybe.add('diff grande');
  if (input.filesTruncated) maybe.add('arquivos demais pra ler');
  if (unsafe.size) return { risk: 'unsafe', reasons: [...unsafe] };
  if (maybe.size) return { risk: 'maybe', reasons: [...maybe] };
  return { risk: 'safe', reasons: [] };
}

export function taskFromBody(body: string): string | undefined {
  return /\bTask:\s*(DFL-\d+)\b/i.exec(body)?.[1]?.toUpperCase();
}

// What the owner must type to merge a PR the hub flags: the PR's own ref, so a
// stray tap on a phone can't merge a migration.
export function mergeConfirmText(pr: Pick<PrSummary, 'repo' | 'number'>): string {
  return `${pr.repo.split('/')[1] ?? pr.repo}#${pr.number}`;
}

export function needsMergeConfirm(pr: Pick<PrSummary, 'risk' | 'checks' | 'isDraft'>): boolean {
  return pr.risk !== 'safe' || pr.checks === 'failure' || pr.isDraft;
}

export function mergeBlocker(pr: Pick<PrSummary, 'state' | 'mergeable'>): string | null {
  if (pr.state !== 'open') return 'PR não está aberta';
  if (pr.mergeable === 'conflict') return 'PR tem conflito com a base';
  return null;
}

export const PR_URL_RE = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)$/;
