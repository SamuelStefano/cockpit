import { describe, it, expect, vi, afterAll } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = vi.hoisted(() => `${process.env.TMPDIR ?? '/tmp'}/deck-byo-run-${process.pid}`);
vi.mock('../config', () => ({ CONFIG: { workdir: root, projectsDir: `${root}/projects` } }));

import { httpErrorText, parseSseLine, runByo, type ByoDeps } from './byo-run';

afterAll(() => rmSync(root, { recursive: true, force: true }));

const KEY = 'sk-test-key-9999';
const SESSION = '11111111-1111-4111-8111-111111111111';

function sse(chunks: string[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    start(c) { chunks.forEach((x) => c.enqueue(enc.encode(x))); c.close(); },
  });
  return new Response(body, { status: 200 });
}

function turn(deps: Partial<ByoDeps>, over: Record<string, unknown> = {}) {
  const store = { get: () => KEY, set: () => {}, remove: () => {} };
  return new Promise<{ events: any[]; errors: string[] }>((resolve) => {
    const events: any[] = [];
    const errors: string[] = [];
    runByo({
      prompt: 'oi', model: 'agent:byo-deepseek-chat', role: 'admin', resumeId: SESSION,
      onEvent: (e: any) => events.push(e), onError: (m: string) => errors.push(m), onClose: () => resolve({ events, errors }),
      ...over,
    } as any, { fetch: vi.fn() as any, keys: store, ...deps });
  });
}

describe('parseSseLine', () => {
  it('reads text, reasoning and the done marker', () => {
    expect(parseSseLine('data: {"choices":[{"delta":{"content":"a"}}]}')).toEqual({ text: 'a', thinking: undefined });
    expect(parseSseLine('data: {"choices":[{"delta":{"reasoning_content":"r"}}]}')?.thinking).toBe('r');
    expect(parseSseLine('data: [DONE]')).toEqual({ done: true });
    expect(parseSseLine(': keep-alive')).toBeNull();
    expect(parseSseLine('data: {broken')).toBeNull();
  });
});

describe('httpErrorText', () => {
  it('maps auth and balance errors and redacts the key', () => {
    expect(httpErrorText(401, '', KEY)).toMatch(/chave foi recusada/);
    expect(httpErrorText(402, '', KEY)).toMatch(/saldo/);
    expect(httpErrorText(500, `bad ${KEY} here`, KEY)).not.toContain(KEY);
  });
});

describe('runByo', () => {
  it('streams text across split chunks and sends the key only as a header', async () => {
    const fetchMock = vi.fn(async () => sse([
      'data: {"choices":[{"delta":{"reasoning_content":"pen"}}]}\n\ndata: {"choices":[{"delta":{"content":"Ol',
      'á"}}]}\n\ndata: {"choices":[{"delta":{"content":" mundo"}}]}\n\ndata: [DONE]\n\n',
    ]));
    const { events, errors } = await turn({ fetch: fetchMock as any });
    expect(errors).toEqual([]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect((init.headers as any).authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: 'deepseek-chat', stream: true, messages: [{ role: 'user', content: 'oi' }] });
    expect(init.body as string).not.toContain(KEY);
    const text = events.filter((e) => e.event?.delta?.type === 'text_delta').map((e) => e.event.delta.text).join('');
    expect(text).toBe('Olá mundo');
    expect(events.some((e) => e.event?.delta?.type === 'thinking_delta')).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: 'result', subtype: 'success', is_error: false });
    const jsonl = readFileSync(join(root, 'projects', `${SESSION}.jsonl`), 'utf8');
    expect(jsonl).toContain('Olá mundo');
    expect(jsonl).not.toContain(KEY);
  });

  it('replays earlier turns of the same session as chat history', async () => {
    const fetchMock = vi.fn(async () => sse(['data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n']));
    await turn({ fetch: fetchMock as any }, { prompt: 'de novo' });
    const body = JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
    expect(body.messages.map((m: any) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(body.messages[1].content).toBe('Olá mundo');
    expect(body.messages[2].content).toBe('de novo');
  });

  it('reports a rejected key without leaking it', async () => {
    const { errors, events } = await turn({ fetch: (async () => new Response(`denied ${KEY}`, { status: 401 })) as any });
    expect(errors[0]).toMatch(/chave foi recusada/);
    expect(errors[0]).not.toContain(KEY);
    expect(events.at(-1)).toMatchObject({ is_error: true, subtype: 'error_shown' });
  });

  it('refuses non-admin roles, missing keys and unknown models without calling the network', async () => {
    const fetchMock = vi.fn();
    expect((await turn({ fetch: fetchMock as any }, { role: 'student' })).errors[0]).toMatch(/só rodam para admin/);
    const noKey = { get: () => undefined, set: () => {}, remove: () => {} };
    expect((await turn({ fetch: fetchMock as any, keys: noKey })).errors[0]).toMatch(/não está configurada/);
    expect((await turn({ fetch: fetchMock as any }, { model: 'agent:byo-nope-x' })).errors[0]).toMatch(/não está configurada/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('turns a network failure into a readable error', async () => {
    const { errors } = await turn({ fetch: (async () => { throw new Error('ECONNRESET'); }) as any });
    expect(errors[0]).toMatch(/DeepSeek: ECONNRESET/);
  });
});
