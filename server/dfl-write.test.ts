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
  process.env.DFL_FLOWS_API = 'https://flows.test';
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
  delete process.env.DFL_FLOWS_API;
  await rm(dir, { recursive: true, force: true });
});

const TASK = '11111111-1111-4111-8111-111111111111';
const DELIVERY = '22222222-2222-4222-8222-222222222222';
const TASK2 = '44444444-4444-4444-8444-444444444444';

function invoiceCmd(over: Record<string, unknown> = {}) {
  return {
    kind: 'invoice-create' as const,
    deliveryId: DELIVERY, deliveryName: 'Entrega A',
    projectId: null, projectName: 'Projeto X',
    referenceMonth: '2026-08', pricePerPoint: 75,
    tasks: [{ id: TASK, title: 'Task 1', points: 2 }],
    ...over,
  };
}

describe('runWrite: validação antes de tocar a rede', () => {
  it('recusa referenceMonth fora de YYYY-MM', async () => {
    await expect(runWrite(invoiceCmd({ referenceMonth: '08/2026' }))).rejects.toThrow('referenceMonth inválido');
    expect(calls).toHaveLength(0);
  });

  it('recusa seleção sem nenhuma task faturável', async () => {
    await expect(runWrite(invoiceCmd({ tasks: [{ id: TASK, title: 'T', points: 0 }] }))).rejects.toThrow('nenhuma task faturável');
    expect(calls).toHaveLength(0);
  });

  it('recusa taskId que não é uuid no points-change', async () => {
    await expect(runWrite({ kind: 'points-change', taskId: 'nope', taskName: 'T', currentPoints: 1, newPoints: 2 }))
      .rejects.toThrow('taskId inválido');
    expect(calls).toHaveLength(0);
  });

  it('recusa newPoints negativo', async () => {
    await expect(runWrite({ kind: 'points-change', taskId: TASK, taskName: 'T', currentPoints: 1, newPoints: -1 }))
      .rejects.toThrow('newPoints inválido');
    expect(calls).toHaveLength(0);
  });
});

describe('invoice-create: totais e itens', () => {
  it('soma o total em centavos a partir dos pontos e do preço por ponto', async () => {
    queue = [reply(200, []), reply(200, []), reply(200, []), reply(201, [{ id: 'inv-1' }]), reply(201, '')];
    const r = await runWrite(invoiceCmd({ tasks: [
      { id: TASK, title: 'A', points: 2 },
      { id: TASK2, title: 'B', points: 3.5 },
    ] }));
    expect(r.totalPoints).toBe(5.5);
    expect(r.totalAmountCents).toBe(41250); // (2 + 3,5) × 75 × 100
    expect(r.invoiceId).toBe('inv-1');
  });

  it('cai no preço padrão de 75 quando pricePerPoint vem inválido', async () => {
    queue = [reply(200, []), reply(200, []), reply(200, []), reply(201, [{ id: 'inv-2' }]), reply(201, '')];
    const r = await runWrite(invoiceCmd({ pricePerPoint: 0 }));
    expect(r.totalAmountCents).toBe(15000); // 2 × 75 × 100
  });

  // A delivery da TASK manda, não a do comando: o gerador de invoice esconde
  // delivery já faturada por `metadata.delivery_id`, então um invoice que junta
  // duas deliveries precisa estampar a de cada item — senão a outra volta a
  // parecer não faturada e é cobrada de novo.
  it('estampa a delivery de cada task, não a do comando', async () => {
    queue = [reply(200, []), reply(200, []), reply(200, []), reply(201, [{ id: 'inv-3' }]), reply(201, '')];
    const outra = '33333333-3333-4333-8333-333333333333';
    await runWrite(invoiceCmd({ tasks: [
      { id: TASK, title: 'A', points: 1, deliveryId: outra, deliveryName: 'Entrega B' },
      { id: TASK2, title: 'B', points: 1 },
    ] }));
    const items = JSON.parse(calls.at(-1)!.body!) as Array<{ metadata: { delivery_id: string; delivery_name: string } }>;
    expect(items[0].metadata.delivery_id).toBe(outra);
    expect(items[0].metadata.delivery_name).toBe('Entrega B');
    expect(items[1].metadata.delivery_id).toBe(DELIVERY);
    expect(items[1].metadata.delivery_name).toBe('Entrega A');
  });

  it('apaga as faturas rejeitadas do mesmo mês antes de inserir', async () => {
    queue = [reply(200, []), reply(200, []), reply(200, [{ id: 'old' }]), reply(204, ''), reply(204, ''), reply(201, [{ id: 'inv-4' }]), reply(201, '')];
    await runWrite(invoiceCmd());
    expect(calls[3]).toMatchObject({ method: 'DELETE' });
    expect(calls[3].url).toContain('invoice_items?invoice_id=in.(old)');
    expect(calls[4].url).toContain('invoices?id=in.(old)');
  });

  it('falha explicitamente quando o INSERT não devolve id', async () => {
    queue = [reply(200, []), reply(200, []), reply(200, []), reply(201, [])];
    await expect(runWrite(invoiceCmd())).rejects.toThrow('INSERT invoice não retornou id');
  });
});

// REGRESSÃO: o retry de 401 era da SEQUÊNCIA inteira. Um 401 no INSERT dos itens
// refazia tudo desde o começo — e como a fatura da 1ª tentativa nasce 'submitted'
// (o dedupe só apaga 'rejected'), sobravam DUAS faturas do mesmo mês, a primeira
// sem itens. Agora o refresh repete só a requisição que levou 401.
describe('invoice-create: never bills a task twice', () => {
  it('refuses when a task already sits on a live invoice', async () => {
    queue = [
      reply(200, [{ invoice_id: 'inv-old', source_id: TASK }]),
      reply(200, [{ id: 'inv-old', status: 'submitted' }]),
    ];
    await expect(runWrite(invoiceCmd())).rejects.toThrow('já estão numa fatura submitted');
    expect(calls.filter((c) => c.method !== 'GET')).toHaveLength(0);
  });

  it('allows it again when the only invoice was rejected', async () => {
    queue = [
      reply(200, [{ invoice_id: 'inv-rej', source_id: TASK }]),
      reply(200, []),                 // no non-rejected invoice among them
      reply(200, []),                 // no empty invoice this month
      reply(200, []),                 // select rejected (same month)
      reply(201, [{ id: 'inv-6' }]),
      reply(201, ''),
    ];
    const r = await runWrite(invoiceCmd());
    expect(r.invoiceId).toBe('inv-6');
  });

  it('refuses the same task twice in one selection', async () => {
    await expect(runWrite(invoiceCmd({ tasks: [
      { id: TASK, title: 'A', points: 1 }, { id: TASK, title: 'A', points: 1 },
    ] }))).rejects.toThrow('task repetida');
    expect(calls).toHaveLength(0);
  });

  it('removes the invoice when inserting its items fails', async () => {
    queue = [
      reply(200, []), reply(200, []), reply(200, []),
      reply(201, [{ id: 'inv-7' }]),
      reply(500, 'boom'),             // items insert fails
      reply(204, ''), reply(200, [{ id: 'inv-7' }]), // rollback deletes (invoice DELETE returns the row)
    ];
    await expect(runWrite(invoiceCmd())).rejects.toThrow('PostgREST 500');
    const deletes = calls.filter((c) => c.method === 'DELETE').map((c) => c.url);
    expect(deletes[0]).toContain('invoice_items?invoice_id=eq.inv-7');
    expect(deletes[1]).toContain('invoices?id=eq.inv-7');
  });
});

describe('invoice-create: nothing half-written is left silently', () => {
  it('says the invoice stayed empty when the rollback deleted nothing (RLS)', async () => {
    queue = [
      reply(200, []), reply(200, []), reply(200, []),
      reply(201, [{ id: 'inv-8' }]),
      reply(500, 'boom'),
      reply(204, ''), reply(200, []), // invoice DELETE removed 0 rows
    ];
    await expect(runWrite(invoiceCmd())).rejects.toThrow('fatura inv-8 ficou vazia no DFL');
  });

  it('refuses a new invoice while an empty one exists for the month', async () => {
    queue = [reply(200, []), reply(200, [{ id: 'shell', created_at: '2026-08-01T00:00:00Z' }]), reply(200, [])];
    await expect(runWrite(invoiceCmd())).rejects.toThrow('fatura shell de 2026-08 está vazia');
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('only looks at submitted invoices, so an itemless paid one does not block the month', async () => {
    queue = [reply(200, []), reply(200, [])];
    await expect(runWrite(invoiceCmd())).rejects.toThrow();
    expect(calls[1].url).toContain('status=eq.submitted');
  });

  it('does not call a just-created itemless invoice orphaned (another writer mid-flight)', async () => {
    queue = [reply(200, []), reply(200, [{ id: 'fresh', created_at: new Date().toISOString() }]), reply(200, [])];
    const err = await runWrite(invoiceCmd()).catch((e: Error) => e);
    expect(String(err)).toContain('pode estar sendo gravada agora');
    expect(String(err)).not.toContain('apague');
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('says the state is unknown when the items POST timed out and the rollback removed nothing', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    const replies = [reply(200, []), reply(200, []), reply(200, []), reply(201, [{ id: 'inv-9' }])];
    let n = 0;
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), method: (init?.method ?? 'GET').toUpperCase() });
      n++;
      if (n <= replies.length) return new Response(replies[n - 1].body || null, { status: replies[n - 1].status });
      if (n === 5) throw timeout;       // items POST: no answer
      if (n === 6) return new Response(null, { status: 204 });
      return new Response('[]', { status: 200 }); // invoice DELETE: FK kept it
    }) as typeof fetch;
    const err = await runWrite(invoiceCmd()).catch((e: Error) => e);
    expect(String(err)).toContain('estado desconhecido');
    expect(String(err)).not.toContain('vazia');
  });
});

describe('invoice-create: 401 no meio da sequência', () => {
  it('repete só a requisição que falhou, sem inserir a fatura de novo', async () => {
    queue = [
      reply(200, []),               // already-invoiced guard
      reply(200, []),               // no empty invoice this month
      reply(200, []),               // select rejected
      reply(201, [{ id: 'inv-5' }]), // INSERT invoices
      reply(401, 'jwt expired'),     // INSERT invoice_items → 401
      reply(201, ''),                // retry do INSERT de itens, já com token novo
    ];
    const r = await runWrite(invoiceCmd());
    expect(r.invoiceId).toBe('inv-5');
    expect(refreshed.count).toBe(1);
    const inserts = calls.filter((c) => c.method === 'POST' && c.url.includes('/invoices'));
    expect(inserts).toHaveLength(1);
    const itemInserts = calls.filter((c) => c.method === 'POST' && c.url.includes('/invoice_items'));
    expect(itemInserts).toHaveLength(2);
  });

  it('propaga o erro quando o retry também leva 401', async () => {
    queue = [reply(401, 'no'), reply(401, 'no')];
    await expect(runWrite(invoiceCmd())).rejects.toThrow('PostgREST 401');
    expect(refreshed.count).toBe(1);
  });
});

describe('points-change: leitura do veredito do workflow', () => {
  it('aceita quando o workflow aplicou', async () => {
    queue = [reply(200, { current_node_id: 'end', variables: { applied: true } })];
    const r = await runWrite({ kind: 'points-change', taskId: TASK, taskName: 'T', currentPoints: 2, newPoints: 5 });
    expect(r).toEqual({ applied: true, taskId: TASK, newPoints: 5 });
  });

  it('falha quando o workflow terminou em rejeição', async () => {
    queue = [reply(200, { current_node_id: 'end_rejected', variables: { applied: false } })];
    await expect(runWrite({ kind: 'points-change', taskId: TASK, taskName: 'T', currentPoints: 2, newPoints: 5 }))
      .rejects.toThrow('workflow não aplicou');
  });

  it('trunca pontos fracionários (a coluna é inteira)', async () => {
    queue = [reply(200, { current_node_id: 'end', variables: { applied: true } })];
    const r = await runWrite({ kind: 'points-change', taskId: TASK, taskName: 'T', currentPoints: 2, newPoints: 5.9 });
    expect(r.newPoints).toBe(5);
    expect(JSON.parse(calls[0].body!).variables.payload.new_points).toBe(5);
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
