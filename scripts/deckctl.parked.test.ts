import { describe, it, expect } from 'vitest';
import { WebSocketServer } from 'ws';
import type { AddressInfo } from 'node:net';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// `new=$(deckctl new … | tail -1)` (~/bin/marathon-watch) stores stdout as the
// session id: a parked send must leave stdout empty and exit 3.
describe('deckctl new when the server parks the send', () => {
  it('exits 3 fast with nothing on stdout', async () => {
    const wss = new WebSocketServer({ port: 0 });
    await new Promise<void>((r) => wss.once('listening', r));
    wss.on('connection', (ws) => ws.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      if (m.t === 'send') ws.send(JSON.stringify({ t: 'send-parked', sessionKey: m.sessionKey, message: 'quota' }));
    }));
    const { port } = wss.address() as AddressInfo;
    try {
      const r = await new Promise<{ code: number | null; out: string; err: string }>((done) => {
        const p = spawn(resolve(here, '../node_modules/.bin/tsx'), [resolve(here, 'deckctl.mts'), 'new', 'hello'], { env: { ...process.env, COCKPIT_PORT: String(port), COCKPIT_TOKEN: 'tok' } });
        let out = ''; let err = '';
        p.stdout.on('data', (d) => { out += d; });
        p.stderr.on('data', (d) => { err += d; });
        p.on('close', (code) => done({ code, out, err }));
      });
      expect(r.code).toBe(3);
      expect(r.out).toBe('');
      expect(r.err).toContain('parked');
    } finally { wss.close(); }
  }, 20_000);
});
