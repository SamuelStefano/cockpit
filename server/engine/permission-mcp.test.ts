import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const SCRIPT = join(__dirname, 'permission-mcp.mjs');

function talk(frames: unknown[], flags: string[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT, ...flags], { stdio: ['pipe', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (c) => { out += c; });
    child.on('error', reject);
    child.on('close', () => resolve(out.split('\n').filter(Boolean).map((l) => JSON.parse(l))));
    for (const f of frames) child.stdin.write(`${JSON.stringify(f)}\n`);
    child.stdin.end();
  });
}

const call = (toolName: string) => ({
  jsonrpc: '2.0', id: 2, method: 'tools/call',
  params: { name: 'prompt', arguments: { tool_name: toolName, input: {} } },
});

const decisionOf = (frame: any) => JSON.parse(frame.result.content[0].text);

describe('permission-mcp', () => {
  it('handshakes and exposes exactly one tool', async () => {
    const [init, list] = await talk([
      { jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    ]);
    expect(init.result.serverInfo.name).toBe('deck-permission');
    expect(list.result.tools.map((t: any) => t.name)).toEqual(['prompt']);
  });

  it('denies every tool without --allow-all (plan mode)', async () => {
    const [bash, ask] = await talk([call('Monitor'), { ...call('AskUserQuestion'), id: 3 }]);
    expect(decisionOf(bash).behavior).toBe('deny');
    expect(decisionOf(ask).behavior).toBe('deny');
  });

  it('allows any tool with --allow-all, passing the input through', async () => {
    const frame = { ...call('Monitor'), params: { name: 'prompt', arguments: { tool_name: 'Monitor', input: { command: 'x' } } } };
    const [monitor] = await talk([frame], ['--allow-all']);
    expect(decisionOf(monitor)).toEqual({ behavior: 'allow', updatedInput: { command: 'x' } });
  });

  it('still routes AskUserQuestion to the Deck card with --allow-all', async () => {
    const [ask] = await talk([call('AskUserQuestion')], ['--allow-all']);
    expect(decisionOf(ask)).toMatchObject({ behavior: 'deny', message: expect.stringMatching(/card no Deck/) });
  });

  it('tells the model the question was delivered as a Deck card', async () => {
    const [ask] = await talk([call('AskUserQuestion')]);
    expect(decisionOf(ask).message).toMatch(/card no Deck/);
  });

  it('survives a malformed frame instead of dying mid-turn', async () => {
    const child = spawn(process.execPath, [SCRIPT], { stdio: ['pipe', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (c) => { out += c; });
    child.stdin.write('not json\n');
    child.stdin.write(`${JSON.stringify(call('Bash'))}\n`);
    child.stdin.end();
    await new Promise((r) => child.on('close', r));
    expect(decisionOf(JSON.parse(out.trim()))).toMatchObject({ behavior: 'deny' });
  });

  it('ignores notifications (no id) instead of replying to them', async () => {
    const frames = await talk([{ jsonrpc: '2.0', method: 'notifications/initialized' }, call('Bash')]);
    expect(frames).toHaveLength(1);
    expect(frames[0].id).toBe(2);
  });
});
