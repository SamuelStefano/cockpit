import { describe, it, expect } from 'vitest';
import { WebSocketServer, type WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TSX = resolve(here, '../node_modules/.bin/tsx');
const CLI = resolve(here, 'deckctl.mts');
const S = '11111111-2222-4333-8444-555555555555';

type Frame = { t: string; [k: string]: unknown };

// Runs `deckctl send` against a fake backend. `onSend` plays the server's answer.
async function sendCli(onSend: (m: Frame, ws: WebSocket) => void) {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((r) => wss.once('listening', r));
  const seen: Frame[] = [];
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ t: 'busy', keys: [] }));
    ws.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      seen.push(m);
      if (m.t === 'send') onSend(m, ws);
    });
  });
  const { port } = wss.address() as AddressInfo;
  try {
    const r = await new Promise<{ code: number | null; out: string }>((done) => {
      const p = spawn(TSX, [CLI, 'send', S, 'hello'], { env: { ...process.env, COCKPIT_PORT: String(port), COCKPIT_TOKEN: 'tok' } });
      let out = '';
      p.stdout.on('data', (d) => { out += d; });
      p.stderr.on('data', (d) => { out += d; });
      p.on('close', (code) => done({ code, out }));
    });
    return { ...r, seen };
  } finally { wss.close(); }
}

const reply = (ws: WebSocket, m: object) => ws.send(JSON.stringify(m));

describe('deckctl send delivery receipt', () => {
  it('sends a msgId and reports a started turn only after its echo', async () => {
    const r = await sendCli((m, ws) => {
      reply(ws, { t: 'user', sessionKey: S, id: m.msgId, text: m.text, ts: 1 });
      reply(ws, { t: 'started', sessionKey: S, model: 'sonnet' });
    });
    expect(r.seen.find((m) => m.t === 'send')?.msgId).toMatch(/^deckctl-/);
    expect(r.code).toBe(0);
    expect(r.out).toContain('turn started');
  }, 30_000);

  it('does not claim success on a foreign started with no echo of its msgId', async () => {
    const r = await sendCli((_m, ws) => {
      reply(ws, { t: 'started', sessionKey: S, model: 'sonnet' });
    });
    expect(r.code).not.toBe(0);
    expect(r.out).not.toContain('turn started');
    expect(r.out).toContain('not confirmed');
  }, 40_000);

  it('reports a message queued behind a running twin turn', async () => {
    const r = await sendCli((m, ws) => {
      reply(ws, { t: 'user', sessionKey: S, id: m.msgId, text: m.text, ts: 1 });
      reply(ws, { t: 'triage', sessionKey: S, msgId: m.msgId, action: 'wait', reason: 'busy' });
    });
    expect(r.code).toBe(0);
    expect(r.out).toContain('queued behind');
    expect(r.out).not.toContain('turn started');
  }, 30_000);

  it('fails on a reject carrying its msgId', async () => {
    const r = await sendCli((m, ws) => {
      reply(ws, { t: 'send-reject', sessionKey: S, reason: 'live-elsewhere', text: m.text, msgId: m.msgId, message: 'busy elsewhere' });
    });
    expect(r.code).not.toBe(0);
    expect(r.out).toContain('busy elsewhere');
  }, 30_000);
});
