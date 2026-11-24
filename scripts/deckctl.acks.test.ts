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
const card = { id: 'fix-login-1234abcd', title: 'fix login', prompt: '', status: 'todo', kind: 'task', contextIds: [], sessionIds: [], createdAt: 1, updatedAt: 1 };

// Runs the real CLI against a fake backend. `reply` answers each client frame.
async function deckctl(args: string[], reply: (m: { t: string; [k: string]: unknown }, ws: WebSocket) => void, onConnect?: (ws: WebSocket) => void) {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((r) => wss.once('listening', r));
  wss.on('connection', (ws) => {
    onConnect?.(ws);
    ws.on('message', (raw) => reply(JSON.parse(String(raw)), ws));
  });
  const { port } = wss.address() as AddressInfo;
  try {
    return await new Promise<{ code: number | null; out: string }>((done) => {
      const p = spawn(TSX, [CLI, ...args], { env: { ...process.env, COCKPIT_PORT: String(port), COCKPIT_TOKEN: 'tok' } });
      let out = '';
      p.stdout.on('data', (d) => { out += d; });
      p.stderr.on('data', (d) => { out += d; });
      p.on('close', (code) => done({ code, out }));
    });
  } finally { wss.close(); }
}

const send = (ws: WebSocket, m: object) => ws.send(JSON.stringify(m));

describe('deckctl mutation acks', () => {
  it('card move fails when the save is answered with an error', async () => {
    const r = await deckctl(['card', 'move', 'fix-login', 'doing'], (m, ws) => {
      if (m.t === 'canvas-get') send(ws, { t: 'canvas-board', board: { cards: [card] } });
      if (m.t === 'canvas-card-save') send(ws, { t: 'error', message: 'card inválido' });
    });
    expect(r.code).not.toBe(0);
    expect(r.out).toContain('card inválido');
  }, 30_000);

  it('card move succeeds only on a board that has the new status', async () => {
    const r = await deckctl(['card', 'move', 'fix-login', 'doing'], (m, ws) => {
      if (m.t === 'canvas-get') send(ws, { t: 'canvas-board', board: { cards: [card] } });
      if (m.t === 'canvas-card-save') send(ws, { t: 'canvas-board', board: { cards: [{ ...card, status: 'doing' }] } });
    });
    expect(r.code).toBe(0);
    expect(r.out).toContain('-> doing');
  }, 30_000);

  it('hide is not confirmed by the archived list sent on connect', async () => {
    const r = await deckctl(['hide', S], () => {}, (ws) => send(ws, { t: 'archived', items: [] }));
    expect(r.code).not.toBe(0);
    expect(r.out).toContain('did not confirm hide');
  }, 40_000);
});

describe('deckctl card run when only the status move fails', () => {
  it('exits 0 (the turn started) and warns on stderr', async () => {
    const r = await deckctl(['card', 'run', 'fix-login'], (m, ws) => {
      if (m.t === 'canvas-get') send(ws, { t: 'canvas-board', board: { cards: [card] } });
      if (m.t === 'send') send(ws, { t: 'system', sessionKey: m.sessionKey, sessionId: S });
      if (m.t === 'canvas-card-save') send(ws, { t: 'error', message: 'board lock' });
    });
    expect(r.code).toBe(0);
    expect(r.out).toContain('was not moved to doing');
    expect(r.out).toContain(`running on session ${S}`);
  }, 30_000);
});
