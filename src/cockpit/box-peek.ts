import type { SessionMeta } from '../../shared/protocol';
import { withBox } from './session';

export type PeekStatus = 'idle' | 'connecting' | 'open' | 'locked';

export interface PeekState {
  status: PeekStatus;
  sessions: SessionMeta[];
  busy: string[];
}

export const IDLE_PEEK: PeekState = { status: 'idle', sessions: [], busy: [] };

export interface PeekSocket {
  onopen: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface PeekDeps {
  isEnrolled: (box: string) => Promise<boolean>;
  dial: (box: string) => PeekSocket;
  onChange: (s: PeekState) => void;
}

const MAX_SESSIONS = 500;
const RETRY_MS = [2_000, 5_000, 15_000, 30_000];

export function peekUrl(base: string, box: string): string {
  const url = withBox(base, box);
  try {
    const u = new URL(url);
    u.searchParams.set('peek', '1');
    return u.toString();
  } catch {
    return `${url}&peek=1`;
  }
}

export function parseSessions(items: unknown): SessionMeta[] {
  if (!Array.isArray(items)) return [];
  const out: SessionMeta[] = [];
  for (const raw of items.slice(0, MAX_SESSIONS)) {
    const m = raw as Partial<SessionMeta> | null;
    if (!m || typeof m.id !== 'string' || !m.id) continue;
    out.push({
      id: m.id,
      title: typeof m.title === 'string' ? m.title : '',
      relative: typeof m.relative === 'string' ? m.relative : '',
      snippet: '',
      mtime: typeof m.mtime === 'number' ? m.mtime : 0,
      count: typeof m.count === 'number' ? m.count : 0,
      waiting: m.waiting === true,
    });
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

// One read-only view of another box's sidebar: asks for the summary stream, the
// session list and busy flags, and redials with backoff while it is wanted.
export class BoxPeek {
  private state: PeekState = { ...IDLE_PEEK, status: 'connecting' };
  private sock: PeekSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private disposed = false;

  constructor(private readonly box: string, private readonly deps: PeekDeps) {
    deps.onChange(this.state);
    void this.start();
  }

  private set(patch: Partial<PeekState>): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.deps.onChange(this.state);
  }

  private async start(): Promise<void> {
    if (this.disposed) return;
    if (!(await this.deps.isEnrolled(this.box).catch(() => false))) { this.set({ status: 'locked' }); return; }
    if (this.disposed) return;
    const s = this.deps.dial(this.box);
    this.sock = s;
    s.onopen = () => {
      this.attempt = 0;
      s.send(JSON.stringify({ t: 'subscribe', scope: 'summary' }));
      s.send(JSON.stringify({ t: 'list' }));
      this.set({ status: 'open' });
    };
    s.onmessage = (ev) => this.onFrame(String(ev.data));
    s.onclose = () => {
      if (this.sock !== s || this.disposed) return;
      this.sock = null;
      this.set({ status: 'connecting' });
      const wait = RETRY_MS[Math.min(this.attempt++, RETRY_MS.length - 1)];
      this.timer = setTimeout(() => { this.timer = null; void this.start(); }, wait);
    };
  }

  private onFrame(text: string): void {
    let m: { t?: unknown; items?: unknown; keys?: unknown };
    try { m = JSON.parse(text); } catch { return; }
    if (m.t === 'sessions') this.set({ sessions: parseSessions(m.items) });
    else if (m.t === 'busy' && Array.isArray(m.keys)) this.set({ busy: m.keys.filter((k): k is string => typeof k === 'string') });
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    const s = this.sock;
    this.sock = null;
    if (s) { s.onopen = s.onmessage = s.onclose = null; s.close(1000, 'peek closed'); }
  }
}
