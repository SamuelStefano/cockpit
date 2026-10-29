import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// `dfl-auth refresh` é um binário REAL na máquina do Samuel: sem este mock o teste
// do retry de 401 dispararia uma renovação de token de produção de verdade.
const refreshed = vi.hoisted(() => ({ count: 0 }));
vi.mock('node:child_process', async (orig) => {
  const real = await orig<typeof import('node:child_process')>();
  return {
    ...real,
    execFile: (cmd: string, _args: unknown, _opts: unknown, cb: (e: Error | null, r: { stdout: string; stderr: string }) => void) => {
      if (cmd === 'dfl-auth') refreshed.count++;
      cb(null, { stdout: '', stderr: '' });
    },
  };
});

const { runWrite } = await import('./dfl-write');

let dir: string;
const realFetch = globalThis.fetch;

// Fila de respostas: cada chamada consome a próxima. `calls` guarda url+init pra
// afirmar QUAIS requisições saíram — é o ponto do teste do retry.
let queue: Array<{ status: number; body: string }> = [];
const calls: Array<{ url: string; method: string; body?: string }> = [];

function reply(status: number, body: unknown = ''): { status: number; body: string } {
  return { status, body: typeof body === 'string' ? body : JSON.stringify(body) };
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'deck-dflwrite-'));
  await writeFile(join(dir, 'project.json'), JSON.stringify({ supabase_url: 'https://db.test', supabase_anon_key: 'anon' }));
  await writeFile(join(dir, 'credentials.json'), JSON.stringify({ access_token: 'tok' }));
  process.env.DFL_MCP_DIR = dir;
  queue = [];
  calls.length = 0;
  refreshed.count = 0;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), method: (init?.method ?? 'GET').toUpperCase(), body: init?.body as string | undefined });
    const next = queue.shift();
    if (!next) throw new Error(`requisição inesperada: ${String(url)}`);
    // 204 não admite corpo no construtor de Response — corpo vazio vira null.
    return new Response(next.body || null, { status: next.status });
  }) as typeof fetch;
});

afterEach(async () => {
  globalThis.fetch = realFetch;
  delete process.env.DFL_MCP_DIR;
  await rm(dir, { recursive: true, force: true });
});

const TASK = '11111111-1111-4111-8111-111111111111';
const DELIVERY = '22222222-2222-4222-8222-222222222222';

describe('runWrite: 401 no meio de uma requisição', () => {
  it('repete só a requisição que falhou, depois do refresh', async () => {
    queue = [reply(401, 'jwt expired'), reply(200, [{ id: TASK, status: 'done', updated_at: '2026-09-23T12:00:00.000Z' }])];
    const r = await runWrite({ kind: 'task-status', taskId: TASK, status: 'done' });
    expect(r.taskId).toBe(TASK);
    expect(refreshed.count).toBe(1);
    expect(calls).toHaveLength(2);
  });

  it('propaga o erro quando o retry também leva 401', async () => {
    queue = [reply(401, 'no'), reply(401, 'no')];
    await expect(runWrite({ kind: 'task-status', taskId: TASK, status: 'done' })).rejects.toThrow('PostgREST 401');
    expect(refreshed.count).toBe(1);
  });
});

const EPIC = '44444444-4444-4444-8444-444444444444';

function taskCreateCmd(over: Record<string, unknown> = {}) {
  return { kind: 'task-create' as const, epicId: EPIC, deliveryId: DELIVERY, taskName: 'Nova task', why: 'motivo', what: 'o que foi feito', ...over };
}

describe('task-create: comando de INSERT em work.tasks (mesmo canal sancionado que a UI DFL)', () => {
  it('insere name/status/stage_id/owner_id/epic_id/delivery_id/description(why+what), NUNCA points/valor', async () => {
    queue = [reply(201, [{ id: 'task-1', name: 'Nova task', status: 'to_do' }])];
    const r = await runWrite(taskCreateCmd());
    expect(r).toMatchObject({ taskId: 'task-1', name: 'Nova task', status: 'to_do' });
    expect(calls[0]).toMatchObject({ method: 'POST' });
    expect(calls[0].url).toContain('/rest/v1/tasks');
    const body = JSON.parse(calls[0].body!);
    expect(body).toMatchObject({ name: 'Nova task', status: 'to_do', stage_id: 'execution', epic_id: EPIC, delivery_id: DELIVERY });
    expect(body.description).toContain('motivo');
    expect(body.description).toContain('o que foi feito');
    expect(body).not.toHaveProperty('points');
    expect(body).not.toHaveProperty('amount_cents');
    expect(typeof body.owner_id).toBe('string'); // identidade FIXA no server, não vem do comando
  });

  it('recusa epicId/deliveryId que não são uuid, sem tocar a rede', async () => {
    await expect(runWrite(taskCreateCmd({ epicId: 'nope' }))).rejects.toThrow('epicId inválido');
    await expect(runWrite(taskCreateCmd({ deliveryId: 'nope' }))).rejects.toThrow('deliveryId inválido');
    expect(calls).toHaveLength(0);
  });

  it('recusa um nome vazio (após trim) antes de tocar a rede', async () => {
    await expect(runWrite(taskCreateCmd({ taskName: '   ' }))).rejects.toThrow('taskName vazio');
    expect(calls).toHaveLength(0);
  });

  // Espelha o context.why/what OBRIGATÓRIO do create_task do MCP dfl-work — uma
  // task sem why/what é órfã pra quem não estava na conversa que a gerou.
  it('recusa why ou what vazios, sem tocar a rede', async () => {
    await expect(runWrite(taskCreateCmd({ why: '  ' }))).rejects.toThrow('why/what vazios');
    await expect(runWrite(taskCreateCmd({ what: '' }))).rejects.toThrow('why/what vazios');
    expect(calls).toHaveLength(0);
  });

  it('trunca o nome no teto (200 chars) em vez de deixar o PostgREST recusar', async () => {
    queue = [reply(201, [{ id: 'task-1', name: 'x', status: 'to_do' }])];
    await runWrite(taskCreateCmd({ taskName: 'a'.repeat(500) }));
    const body = JSON.parse(calls[0].body!);
    expect(body.name).toHaveLength(200);
  });

  it('falha explicitamente quando o INSERT não devolve id', async () => {
    queue = [reply(201, [])];
    await expect(runWrite(taskCreateCmd())).rejects.toThrow('INSERT task não retornou id');
  });
});

describe('task-status: comando de PATCH em work.tasks', () => {
  it('faz PATCH só do status (+ updated_at), nunca points/valor, e devolve o updated_at real', async () => {
    queue = [reply(200, [{ id: TASK, status: 'in_progress', updated_at: '2026-09-23T12:00:00.000Z' }])];
    const r = await runWrite({ kind: 'task-status', taskId: TASK, status: 'in_progress' });
    expect(r).toEqual({ taskId: TASK, status: 'in_progress', updatedAt: '2026-09-23T12:00:00.000Z' });
    expect(calls[0]).toMatchObject({ method: 'PATCH' });
    expect(calls[0].url).toContain(`tasks?id=eq.${TASK}`);
    expect(calls[0].url).toContain('select=id,status,updated_at');
    const body = JSON.parse(calls[0].body!);
    expect(Object.keys(body).sort()).toEqual(['status', 'updated_at']);
  });

  it('recusa um status fora do enum de work.tasks', async () => {
    await expect(runWrite({ kind: 'task-status', taskId: TASK, status: 'bogus' as never })).rejects.toThrow('status inválido');
    expect(calls).toHaveLength(0);
  });

  it('recusa taskId que não é uuid', async () => {
    await expect(runWrite({ kind: 'task-status', taskId: 'nope', status: 'done' })).rejects.toThrow('taskId inválido');
    expect(calls).toHaveLength(0);
  });

  // return=representation vazio: a linha não existe (id errado, ou RLS bloqueou
  // silenciosamente) — nunca um "sucesso" mudo que deixaria o card achando que
  // sincronizou quando na verdade nada mudou em work.tasks.
  it('falha explicitamente quando o PATCH não acha a linha', async () => {
    queue = [reply(200, [])];
    await expect(runWrite({ kind: 'task-status', taskId: TASK, status: 'done' })).rejects.toThrow('PATCH task não achou a linha');
  });
});
