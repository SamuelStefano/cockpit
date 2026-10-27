// Roteamento por conta do relay T3 (DR-023, red line #2). O relay NUNCA roteia por
// chave vinda do frame; roteia pelo accountId que cada socket carrega após autenticar
// (derivado server-side do JWT/keypair — red line #1). Um frame da conta A jamais
// alcança a conta B porque o destino é o conjunto de sockets daquela conta, não um
// fan-out global. Puro/testável: opera sobre uma interface mínima de socket.

export interface Sock {
  send(data: string): void;
  readyState?: number;
  bufferedAmount?: number;
  terminate?(): void;
}
const OPEN = 1; // WebSocket.OPEN

// Backpressure: numa aba lenta-mas-aberta o buffer do ws cresce sem limite até
// estourar a heap. Espelha broadcast.ts — frames de alta frequência e
// reconstruíveis (delta/thinking/stats) são pulados PRA AQUELA aba quando o buffer
// passa do teto; o snapshot do thread replaya no próximo reconnect. Frames de ciclo
// de vida sempre vão. Só parseia o tipo quando uma aba está de fato congestionada,
// mantendo o caminho quente limpo.
const BACKPRESSURE_BYTES = 4 * 1024 * 1024;
const DROPPABLE: ReadonlySet<string> = new Set(['delta', 'thinking', 'stats']);
// Hard cap, both directions: past this a socket is not slow, it is not reading.
// Lifecycle frames and every browser→agent frame were buffered without limit, so
// one peer that stopped reading (while its pongs kept the heartbeat happy) could
// grow the relay heap until OOM and drop every account. Cut that socket instead;
// its side reconnects and replays.
export const HARD_BUFFER_BYTES = 64 * 1024 * 1024;
function overHardCap(s: Sock): boolean {
  if (s.bufferedAmount === undefined || s.bufferedAmount <= HARD_BUFFER_BYTES) return false;
  try { s.terminate?.(); } catch { /* already going */ }
  return true;
}
function frameType(data: string): string {
  try { return (JSON.parse(data) as { t?: string }).t ?? '?'; } catch { return '?'; }
}


// A tab is bound to one box at open (`?box=<agentId>`) or to '' = the account's
// primary box (the earliest-bound one online), which is what old clients and
// single-box accounts get. A box only ever receives its own tabs' frames and
// only reaches its own tabs.
interface Bucket {
  agents: Map<string, Sock>;      // agentId → socket; insertion order = bind order
  browsers: Map<Sock, string>;    // tab → bound box ('' = primary)
  present: Map<string, boolean>;  // last presence state sent to each agent
}

export class Registry {
  private byAccount = new Map<string, Bucket>();

  private bucket(accountId: string): Bucket {
    let b = this.byAccount.get(accountId);
    if (!b) { b = { agents: new Map(), browsers: new Map(), present: new Map() }; this.byAccount.set(accountId, b); }
    return b;
  }

  private gc(accountId: string): void {
    const b = this.byAccount.get(accountId);
    if (b && b.agents.size === 0 && b.browsers.size === 0) this.byAccount.delete(accountId);
  }

  private resolveIn(b: Bucket, box: string): string | null {
    if (box) return b.agents.has(box) ? box : null;
    const first = b.agents.keys().next();
    return first.done ? null : first.value;
  }

  // Binds the agent and RETURNS its previous socket (same agentId reconnecting with
  // the old one half-open) for the caller to terminate. Other boxes are untouched.
  bindAgent(accountId: string, agentId: string, sock: Sock): Sock | null {
    const b = this.bucket(accountId);
    const cur = b.agents.get(agentId);
    b.agents.set(agentId, sock);
    if (cur !== sock) b.present.delete(agentId);
    return cur && cur !== sock ? cur : null;
  }

  // True if THIS socket was the bound one. false = a newer socket of the same
  // agent replaced it: the caller must not announce agent-offline.
  unbindAgent(accountId: string, agentId: string, sock: Sock): boolean {
    const b = this.byAccount.get(accountId);
    if (!b || b.agents.get(agentId) !== sock) return false;
    b.agents.delete(agentId);
    b.present.delete(agentId);
    this.gc(accountId);
    return true;
  }

  addBrowser(accountId: string, sock: Sock, box = ''): void {
    this.bucket(accountId).browsers.set(sock, box);
  }

  removeBrowser(accountId: string, sock: Sock): void {
    const b = this.byAccount.get(accountId);
    if (!b) return;
    b.browsers.delete(sock);
    this.gc(accountId);
  }

  // Tabs bound to exactly this box key (the per-box tab cap).
  browserCount(accountId: string, box = ''): number {
    const b = this.byAccount.get(accountId);
    if (!b) return 0;
    let n = 0;
    for (const v of b.browsers.values()) if (v === box) n++;
    return n;
  }

  // Which agent a tab bound to `box` talks to right now, or null (offline).
  resolve(accountId: string, box = ''): string | null {
    const b = this.byAccount.get(accountId);
    return b ? this.resolveIn(b, box) : null;
  }

  primary(accountId: string): string | null { return this.resolve(accountId, ''); }

  boxOf(accountId: string, sock: Sock): string | undefined { return this.byAccount.get(accountId)?.browsers.get(sock); }

  // Any box online (no argument), or the box a tab bound to `box` reaches.
  hasAgent(accountId: string, box?: string): boolean {
    const b = this.byAccount.get(accountId);
    if (!b) return false;
    return box === undefined ? b.agents.size > 0 : this.resolveIn(b, box) !== null;
  }

  agentIds(accountId: string): string[] { return [...(this.byAccount.get(accountId)?.agents.keys() ?? [])]; }

  // Every open tab of the account, any box (role changes, `boxes` updates).
  eachBrowser(accountId: string, fn: (sock: Sock) => void): void {
    const b = this.byAccount.get(accountId);
    if (!b) return;
    for (const s of b.browsers.keys()) {
      if (s.readyState !== undefined && s.readyState !== OPEN) continue;
      fn(s);
    }
  }

  // Open tabs that currently reach this agent, with the box key they are bound to.
  tabsOf(accountId: string, agentId: string): Array<[Sock, string]> {
    const b = this.byAccount.get(accountId);
    if (!b) return [];
    const out: Array<[Sock, string]> = [];
    for (const [s, box] of b.browsers) {
      if (s.readyState !== undefined && s.readyState !== OPEN) continue;
      if (this.resolveIn(b, box) === agentId) out.push([s, box]);
    }
    return out;
  }

  // Presence transitions since the last call, per online agent: true = it has a
  // tab now and had none, false = the reverse. A freshly bound agent always gets
  // its initial state. The caller sends browsers-present / no-browsers.
  presenceChanges(accountId: string): Array<[string, Sock, boolean]> {
    const b = this.byAccount.get(accountId);
    if (!b) return [];
    const watched = new Set<string>();
    for (const box of b.browsers.values()) { const id = this.resolveIn(b, box); if (id) watched.add(id); }
    const out: Array<[string, Sock, boolean]> = [];
    for (const [id, sock] of b.agents) {
      const now = watched.has(id);
      if (b.present.get(id) === now) continue;
      b.present.set(id, now);
      out.push([id, sock, now]);
    }
    return out;
  }

  // Browser frame → the agent its tab is bound to. false = that box is offline.
  // Never reaches another box or another account.
  toAgent(accountId: string, box: string, data: string): boolean {
    const b = this.byAccount.get(accountId);
    const id = b ? this.resolveIn(b, box) : null;
    const agent = id ? b!.agents.get(id) : undefined;
    if (!agent || (agent.readyState !== undefined && agent.readyState !== OPEN)) return false;
    if (overHardCap(agent)) return false;
    agent.send(data);
    return true;
  }

  // Agent frame → the tabs of that account that reach THIS agent. Returns how many got it.
  toBrowsers(accountId: string, agentId: string, data: string): number {
    const b = this.byAccount.get(accountId);
    if (!b) return 0;
    let n = 0;
    let dropChecked = false, droppable = false;
    for (const [s, box] of b.browsers) {
      if (s.readyState !== undefined && s.readyState !== OPEN) continue;
      if (this.resolveIn(b, box) !== agentId) continue;
      if (overHardCap(s)) continue;
      if (s.bufferedAmount !== undefined && s.bufferedAmount > BACKPRESSURE_BYTES) {
        if (!dropChecked) { droppable = DROPPABLE.has(frameType(data)); dropChecked = true; }
        if (droppable) continue;
      }
      s.send(data); n++;
    }
    if (process.env.DECK_RELAY_DEBUG) {
      console.error(`[relay][debug] toBrowsers ${frameType(data)} -> ${n}/${b.browsers.size} browsers (acct ${accountId.slice(0, 8)} box ${agentId.slice(0, 8)})`);
    }
    return n;
  }

  // Sealed frame (T5) → the ONE tab its channel belongs to, only if that tab is in
  // the sender's account AND currently reaches the sender's box. The relay can't
  // read the frame; `droppable` is the agent's plaintext hint for backpressure.
  toBrowser(accountId: string, agentId: string, sock: Sock, data: string, droppable: boolean): boolean {
    const b = this.byAccount.get(accountId);
    const box = b?.browsers.get(sock);
    if (!b || box === undefined || this.resolveIn(b, box) !== agentId) return false;
    if (sock.readyState !== undefined && sock.readyState !== OPEN) return false;
    if (overHardCap(sock)) return false;
    if (droppable && sock.bufferedAmount !== undefined && sock.bufferedAmount > BACKPRESSURE_BYTES) return false;
    sock.send(data);
    return true;
  }

  stats(): { accounts: number; agents: number; browsers: number } {
    let agents = 0, browsers = 0;
    for (const b of this.byAccount.values()) { agents += b.agents.size; browsers += b.browsers.size; }
    return { accounts: this.byAccount.size, agents, browsers };
  }
}
