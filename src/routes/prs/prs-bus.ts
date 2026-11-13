import type { ClientMsg, ServerMsg } from '../../../shared/protocol';
import type { PrDetail, PrDiff, PrsSnapshot, SessionPrs } from '../../../shared/prs';

// Bridge between the /prs page and the socket owned by useCockpit — same shape as
// bench-bus, so the page stays out of useCockpit's 2k lines. State lives here and
// survives navigating away, so coming back to /prs paints the last snapshot at once.
export interface DetailEntry { detail: PrDetail | null; loading: boolean; error?: string }
export interface DiffEntry { diff: PrDiff | null; loading: boolean; error?: string }
// `hydrating`: the full list was asked and has not answered; the count-only ask
// answering first must not make the panel look done.
export interface SessionEntry { session: SessionPrs | null; hydrating: boolean }
export interface MergeResult { ok: boolean; message?: string }

export interface PrsState {
  snapshot: PrsSnapshot | null;
  loading: boolean;
  details: Record<string, DetailEntry>;
  diffs: Record<string, DiffEntry>;
  sessions: Record<string, SessionEntry>;
}

type Pending = { done: (r: MergeResult) => void; timer: ReturnType<typeof setTimeout> };

let sender: ((m: ClientMsg) => boolean) | null = null;
const EMPTY: PrsState = { snapshot: null, loading: false, details: {}, diffs: {}, sessions: {} };
let state: PrsState = EMPTY;
const listeners = new Set<() => void>();
const pending = new Map<string, Pending>();
let seq = 0;

const MERGE_TIMEOUT_MS = 60_000;

function set(next: Partial<PrsState>): void {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

export function setPrsSender(fn: ((m: ClientMsg) => boolean) | null): void {
  sender = fn;
}

export function subscribePrs(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export const getPrsState = (): PrsState => state;

export function requestPrs(force = false): boolean {
  if (!sender?.({ t: 'prs-get', force })) return false;
  set({ loading: true });
  return true;
}

export function requestPrDetail(url: string): boolean {
  if (!sender?.({ t: 'prs-detail-get', url })) return false;
  const prev = state.details[url];
  set({ details: { ...state.details, [url]: { detail: prev?.detail ?? null, loading: true } } });
  return true;
}

// A box whose agent predates the diff frame never answers it: without this the tab
// would sit on a skeleton forever.
const DIFF_TIMEOUT_MS = 25_000;
const diffTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearDiffTimer(url: string): void {
  const t = diffTimers.get(url);
  if (t) clearTimeout(t);
  diffTimers.delete(url);
}

export function requestPrDiff(url: string): boolean {
  if (!sender?.({ t: 'prs-diff-get', url })) {
    set({ diffs: { ...state.diffs, [url]: { diff: state.diffs[url]?.diff ?? null, loading: false, error: 'sem conexão com o servidor' } } });
    return false;
  }
  clearDiffTimer(url);
  diffTimers.set(url, setTimeout(() => {
    diffTimers.delete(url);
    if (!state.diffs[url]?.loading) return;
    set({ diffs: { ...state.diffs, [url]: { diff: state.diffs[url]?.diff ?? null, loading: false, error: 'O servidor não respondeu. Se esta máquina está com o Deck antigo, atualize o agente dela.' } } });
  }, DIFF_TIMEOUT_MS));
  set({ diffs: { ...state.diffs, [url]: { diff: state.diffs[url]?.diff ?? null, loading: true } } });
  return true;
}

// An older agent sends a detail without the newer lists.
const withDefaults = (d: PrDetail | null): PrDetail | null => (d ? { ...d, threads: d.threads ?? [], commits: d.commits ?? [], commitCount: d.commitCount ?? 0 } : d);

const SESSION_TIMEOUT_MS = 25_000;
const sessionTimers = new Map<string, ReturnType<typeof setTimeout>>();

function settleSession(sessionId: string, patch: Partial<SessionEntry>): void {
  const t = sessionTimers.get(sessionId);
  if (t) clearTimeout(t);
  sessionTimers.delete(sessionId);
  const prev = state.sessions[sessionId] ?? { session: null, hydrating: false };
  set({ sessions: { ...state.sessions, [sessionId]: { ...prev, ...patch } } });
}

const EMPTY_SESSION = (sessionId: string, error: string): SessionPrs => ({ sessionId, createdUrls: [], mentionedUrls: [], error });

export function requestSessionPrs(sessionId: string, hydrate: boolean): boolean {
  if (!sender?.({ t: 'prs-session-get', sessionId, hydrate })) return false;
  if (!hydrate) return true;
  settleSession(sessionId, { hydrating: true });
  // A dropped frame or a box on an older agent never answers: stop the skeleton.
  sessionTimers.set(sessionId, setTimeout(() => {
    const prev = state.sessions[sessionId]?.session;
    settleSession(sessionId, { hydrating: false, session: prev ? { ...prev, error: 'O servidor não respondeu.' } : EMPTY_SESSION(sessionId, 'O servidor não respondeu.') });
  }, SESSION_TIMEOUT_MS));
  return true;
}

export function mergePr(url: string, confirm?: string): Promise<MergeResult> {
  if (!sender) return Promise.resolve({ ok: false, message: 'sem conexão com o servidor' });
  const reqId = `m${Date.now().toString(36)}${seq++}`;
  return new Promise<MergeResult>((done) => {
    const timer = setTimeout(() => { pending.delete(reqId); done({ ok: false, message: 'merge sem resposta — confira no GitHub' }); }, MERGE_TIMEOUT_MS);
    pending.set(reqId, { done, timer });
    if (!sender?.({ t: 'prs-merge', reqId, url, confirmText: confirm })) {
      pending.delete(reqId);
      clearTimeout(timer);
      done({ ok: false, message: 'sem conexão com o servidor' });
    }
  });
}

export function failAllPrsPending(reason = 'conexão caiu durante o merge — confira no GitHub'): void {
  const all = [...pending.values()];
  pending.clear();
  for (const p of all) { clearTimeout(p.timer); p.done({ ok: false, message: reason }); }
  if (state.loading) set({ loading: false });
}

// The chat panels hold their own copies of the PR: without this they would keep
// offering "Mergear" on something that just merged.
function markMergedInSessions(url: string): void {
  const sessions = Object.fromEntries(Object.entries(state.sessions).map(([id, e]) => {
    if (!e.session?.prs?.some((p) => p.url === url && p.state === 'open')) return [id, e];
    const prs = e.session.prs.map((p) => (p.url === url ? { ...p, state: 'merged' as const, mergedAt: new Date().toISOString() } : p));
    return [id, { ...e, session: { ...e.session, prs } }];
  }));
  set({ sessions });
}

export function prsDispatch(msg: ServerMsg): void {
  if (msg.t === 'prs') { set({ snapshot: msg.snapshot, loading: msg.pending === true }); return; }
  if (msg.t === 'prs-diff') {
    clearDiffTimer(msg.url);
    set({ diffs: { ...state.diffs, [msg.url]: { diff: msg.diff ?? state.diffs[msg.url]?.diff ?? null, loading: false, error: msg.error } } });
    return;
  }
  if (msg.t === 'prs-session') {
    const id = msg.session.sessionId;
    const prev = state.sessions[id];
    const full = !!msg.session.prs || !!msg.session.error;
    // A count-only answer must not wipe the hydrated list the panel is showing.
    const session = msg.session.prs || !prev?.session?.prs ? msg.session : { ...msg.session, prs: prev.session.prs };
    if (full || !prev?.hydrating) settleSession(id, { session, hydrating: false });
    else set({ sessions: { ...state.sessions, [id]: { session, hydrating: true } } });
    return;
  }
  if (msg.t === 'prs-detail') {
    set({ details: { ...state.details, [msg.url]: { detail: withDefaults(msg.detail) ?? state.details[msg.url]?.detail ?? null, loading: false, error: msg.error } } });
    return;
  }
  if (msg.t === 'prs-merge-result') {
    const p = pending.get(msg.reqId);
    if (!p) return;
    pending.delete(msg.reqId);
    clearTimeout(p.timer);
    p.done({ ok: msg.ok, message: msg.message });
    if (msg.ok) markMergedInSessions(msg.url);
  }
}

export function resetPrsBus(): void {
  failAllPrsPending();
  for (const url of [...diffTimers.keys()]) clearDiffTimer(url);
  for (const t of sessionTimers.values()) clearTimeout(t);
  sessionTimers.clear();
  state = EMPTY;
}
