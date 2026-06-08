// Roteamento por conta do relay T3 (DR-023, red line #2). O relay NUNCA roteia por
// chave vinda do frame; roteia pelo accountId que cada socket carrega após autenticar
// (derivado server-side do JWT/keypair — red line #1). Um frame da conta A jamais
// alcança a conta B porque o destino é o conjunto de sockets daquela conta, não um
// fan-out global. Puro/testável: opera sobre uma interface mínima de socket.

export interface Sock {
  send(data: string): void;
  readyState?: number;
  bufferedAmount?: number;
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
function frameType(data: string): string {
  try { return (JSON.parse(data) as { t?: string }).t ?? '?'; } catch { return '?'; }
}

interface Bucket {
  agent: Sock | null;        // o agente (VPS) pareado daquela conta — no máx 1 ativo
  browsers: Set<Sock>;       // abas/dispositivos logados na conta
}

export class Registry {
  private byAccount = new Map<string, Bucket>();

  private bucket(accountId: string): Bucket {
    let b = this.byAccount.get(accountId);
    if (!b) { b = { agent: null, browsers: new Set() }; this.byAccount.set(accountId, b); }
    return b;
  }

  private gc(accountId: string): void {
    const b = this.byAccount.get(accountId);
    if (b && !b.agent && b.browsers.size === 0) this.byAccount.delete(accountId);
  }

  bindAgent(accountId: string, sock: Sock): void { this.bucket(accountId).agent = sock; }

  unbindAgent(accountId: string, sock: Sock): void {
    const b = this.byAccount.get(accountId);
    if (b && b.agent === sock) { b.agent = null; this.gc(accountId); }
  }

  addBrowser(accountId: string, sock: Sock): void { this.bucket(accountId).browsers.add(sock); }

  removeBrowser(accountId: string, sock: Sock): void {
    const b = this.byAccount.get(accountId);
    if (b) { b.browsers.delete(sock); this.gc(accountId); }
  }

  hasAgent(accountId: string): boolean { return !!this.byAccount.get(accountId)?.agent; }

  // Itera as abas abertas de uma conta (pra reemitir caps quando o agente reporta
  // sua capacidade real depois que a aba já conectou). Escopo por conta, sem fan-out.
  eachBrowser(accountId: string, fn: (sock: Sock) => void): void {
    const b = this.byAccount.get(accountId);
    if (!b) return;
    for (const s of b.browsers) {
      if (s.readyState !== undefined && s.readyState !== OPEN) continue;
      fn(s);
    }
  }

  // Frame de um browser → o agente DAQUELA conta. Retorna false se não há agente
  // pareado/online (a UI mostra "agente offline"). Nunca alcança outra conta.
  toAgent(accountId: string, data: string): boolean {
    const agent = this.byAccount.get(accountId)?.agent;
    if (!agent || (agent.readyState !== undefined && agent.readyState !== OPEN)) return false;
    agent.send(data);
    return true;
  }

  // Frame do agente → as abas DAQUELA conta (escopo por conta; nunca fan-out global).
  // Retorna quantas abas receberam.
  toBrowsers(accountId: string, data: string): number {
    const b = this.byAccount.get(accountId);
    if (!b) return 0;
    let n = 0;
    let dropChecked = false, droppable = false;
    for (const s of b.browsers) {
      if (s.readyState !== undefined && s.readyState !== OPEN) continue;
      if (s.bufferedAmount !== undefined && s.bufferedAmount > BACKPRESSURE_BYTES) {
        if (!dropChecked) { droppable = DROPPABLE.has(frameType(data)); dropChecked = true; }
        if (droppable) continue;
      }
      s.send(data); n++;
    }
    if (process.env.DECK_RELAY_DEBUG) {
      let t = '?'; try { t = (JSON.parse(data) as { t?: string }).t ?? '?'; } catch { /* */ }
      console.error(`[relay][debug] toBrowsers ${t} -> ${n}/${b.browsers.size} browsers (acct ${accountId.slice(0, 8)})`);
    }
    return n;
  }

  stats(): { accounts: number; agents: number; browsers: number } {
    let agents = 0, browsers = 0;
    for (const b of this.byAccount.values()) { if (b.agent) agents++; browsers += b.browsers.size; }
    return { accounts: this.byAccount.size, agents, browsers };
  }
}
