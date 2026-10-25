import { describe, it, expect, beforeEach } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync, readFileSync, appendFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(__dirname, 'team-mcp.mjs');
let dir = '';
const paths = () => ({ team: join(dir, 'team.json'), outbox: join(dir, 'outbox'), log: join(dir, 'log.jsonl'), pause: join(dir, 'paused.json') });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'deck-team-mcp-'));
  writeFileSync(paths().team, JSON.stringify([
    { id: 'lead1', name: 'growth-lead', label: 'lead', primary: true },
    { id: 'ativ1', name: 'growth-ativacao', label: 'ativação', parentId: 'lead1' },
  ]));
});

function argv(hop = 0, waitMs = 0): string[] {
  const p = paths();
  return [SCRIPT, '--bot', 'lead1', '--hop', String(hop), '--team', p.team, '--outbox', p.outbox, '--log', p.log, '--pause', p.pause, '--wait-ms', String(waitMs)];
}

function talk(frames: unknown[], args = argv(), onSpawn?: () => void): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: ['pipe', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (c) => { out += c; });
    child.on('error', reject);
    child.on('close', () => resolve(out.split('\n').filter(Boolean).map((l) => JSON.parse(l))));
    for (const f of frames) child.stdin.write(`${JSON.stringify(f)}\n`);
    child.stdin.end();
    onSpawn?.();
  });
}

const call = (name: string, args: Record<string, unknown> = {}, id = 2) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });
const textOf = (frame: any): string => frame.result.content[0].text;
const spooled = () => (existsSync(paths().outbox) ? readdirSync(paths().outbox).filter((f) => f.endsWith('.json')) : []);

describe('team-mcp', () => {
  it('handshakes and lists its two tools', async () => {
    const [init, list] = await talk([
      { jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    ]);
    expect(init.result.serverInfo.name).toBe('deck-team');
    expect(list.result.tools.map((t: any) => t.name)).toEqual(['team_list', 'team_send']);
  });

  it('team_list names the team, the boss and who the caller is', async () => {
    const [r] = await talk([call('team_list')]);
    expect(textOf(r)).toContain('growth-lead (você) — principal');
    expect(textOf(r)).toContain('growth-ativacao; cargo: ativação; chefe: growth-lead');
  });

  it('team_send writes one spool file with hop+1 and the recipient id', async () => {
    const [r] = await talk([call('team_send', { to: 'Growth-Ativacao', text: 'proponha 1 ação' })], argv(2));
    expect(textOf(r)).toMatch(/enfileirada/i);
    const files = spooled();
    expect(files).toHaveLength(1);
    const body = JSON.parse(readFileSync(join(paths().outbox, files[0]), 'utf8'));
    expect(body).toMatchObject({ from: 'lead1', to: 'ativ1', text: 'proponha 1 ação', hop: 3 });
    expect(files[0]).toBe(`${body.id}.json`);
  });

  it('reports the outcome the backend logged', async () => {
    const answered = talk([call('team_send', { to: 'growth-ativacao', text: 'oi' })], argv(0, 3000), () => {
      const t = setInterval(() => {
        const [f] = spooled();
        if (!f) return;
        clearInterval(t);
        const id = f.replace(/\.json$/, '');
        appendFileSync(paths().log, `${JSON.stringify({ id, from: 'lead1', to: 'ativ1', text: 'oi', ts: 1, hop: 1, status: 'queued' })}\n`);
      }, 50);
    });
    const [r] = await answered;
    expect(textOf(r)).toMatch(/ocupado/);
  });

  it('refuses an unknown bot and a message to itself without spooling', async () => {
    const [a, b] = await talk([call('team_send', { to: 'ninguem', text: 'x' }), call('team_send', { to: 'growth-lead', text: 'x' }, 3)]);
    expect(a.result.isError).toBe(true);
    expect(b.result.isError).toBe(true);
    expect(spooled()).toEqual([]);
  });

  it('tells the model a paused team blocks, while still spooling for the log', async () => {
    writeFileSync(paths().pause, JSON.stringify({ paused: true }));
    const [r] = await talk([call('team_send', { to: 'growth-ativacao', text: 'x' })]);
    expect(textOf(r)).toMatch(/Bloqueada \(equipe pausada\)/);
    expect(spooled()).toHaveLength(1);
  });

  it('tells the model a chain at hop 6 is cut', async () => {
    const [r] = await talk([call('team_send', { to: 'growth-ativacao', text: 'x' })], argv(5));
    expect(textOf(r)).toMatch(/cadeia longa demais \(6 saltos\)/);
  });
});
