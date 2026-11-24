import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { generateKeyPairSync, sign as edSign } from 'node:crypto';
import { createRelay, type DiagReportRow, type RelayStore } from './index';

let server: Server | null = null;
afterEach(() => { server?.close(); server = null; });

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

async function authedAgent(rows: DiagReportRow[]) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pub = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const store: RelayStore = {
    async agentById(id) { return id === 'ag-A' ? { accountId: 'accA', publicKey: pub } : null; },
    async isAdmin() { return false; }, async listAccounts() { return []; }, async setAdmin() { return true; },
    async markAgentSeen() {}, async createPairingCode() { return { code: 'x', expiresAt: '' }; },
    async consumePairingCode() { return null; }, async createAgent() { return null; },
    async listBoxes() { return []; }, async renameBox() { return false; }, async revokeBox() { return false; },
    async insertDiagReport(row) { rows.push(row); return true; },
  };
  const relay = createRelay({ iss: 't', jwksUrl: 'http://x', rootEmails: '', store, resolveIdentity: async () => null });
  server = relay.server;
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  const ws = new WebSocket(`ws://127.0.0.1:${(server!.address() as AddressInfo).port}/agent`);
  await new Promise<void>((resolve) => {
    ws.on('open', () => ws.send(JSON.stringify({ t: 'agent-hello', agentId: 'ag-A' })));
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.t === 'challenge') ws.send(JSON.stringify({ t: 'agent-auth', sig: edSign(null, Buffer.from(`${m.nonce}.ag-A`), privateKey).toString('base64') }));
      if (m.t === 'agent-ready') resolve();
    });
  });
  return { ws, relay };
}

const settle = () => new Promise((r) => setTimeout(r, 80));

describe('agent diag-report frame', () => {
  it('inserts a redacted report bound to the agent account and box, never the frame fields', async () => {
    const rows: DiagReportRow[] = [];
    const { ws } = await authedAgent(rows);
    ws.send(JSON.stringify({ t: 'diag-report', kind: 'crash', lines: [`boom ${JWT}`], version: 'abc1234', account_id: 'evil' }));
    await settle();
    expect(rows).toEqual([{ account_id: 'accA', source: 'agent', kind: 'crash', box_id: 'ag-A', app_version: 'abc1234', payload: { lines: ['boom [jwt]'], version: 'abc1234' } }]);
    ws.close();
  });

  it('drops invalid frames and rate-limits per box', async () => {
    const rows: DiagReportRow[] = [];
    const { ws, relay } = await authedAgent(rows);
    ws.send(JSON.stringify({ t: 'diag-report', kind: 'BAD KIND', lines: [] }));
    for (let i = 0; i < 10; i++) ws.send(JSON.stringify({ t: 'diag-report', kind: 'crash', lines: [String(i)] }));
    await settle();
    expect(rows).toHaveLength(6);
    const ev = relay.obs.recent().filter((e) => e.ev === 'agent_diag');
    expect(ev.some((e) => e.why === 'invalid')).toBe(true);
    expect(ev.filter((e) => e.why === 'rate')).toHaveLength(4);
    ws.close();
  });
});
