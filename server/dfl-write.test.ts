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
    queue = [reply(200, []), reply(201, [{ id: 'inv-1' }]), reply(201, '')];
    const r = await runWrite(invoiceCmd({ tasks: [
      { id: TASK, title: 'A', points: 2 },
      { id: TASK, title: 'B', points: 3.5 },
    ] }));
    expect(r.totalPoints).toBe(5.5);
    expect(r.totalAmountCents).toBe(41250); // (2 + 3,5) × 75 × 100
    expect(r.invoiceId).toBe('inv-1');
  });

  it('cai no preço padrão de 75 quando pricePerPoint vem inválido', async () => {
    queue = [reply(200, []), reply(201, [{ id: 'inv-2' }]), reply(201, '')];
    const r = await runWrite(invoiceCmd({ pricePerPoint: 0 }));
    expect(r.totalAmountCents).toBe(15000); // 2 × 75 × 100
  });

  // A delivery da TASK manda, não a do comando: o gerador de invoice esconde
  // delivery já faturada por `metadata.delivery_id`, então um invoice que junta
  // duas deliveries precisa estampar a de cada item — senão a outra volta a
  // parecer não faturada e é cobrada de novo.
  it('estampa a delivery de cada task, não a do comando', async () => {
    queue = [reply(200, []), reply(201, [{ id: 'inv-3' }]), reply(201, '')];
    const outra = '33333333-3333-4333-8333-333333333333';
    await runWrite(invoiceCmd({ tasks: [
      { id: TASK, title: 'A', points: 1, deliveryId: outra, deliveryName: 'Entrega B' },
      { id: TASK, title: 'B', points: 1 },
    ] }));
    const items = JSON.parse(calls.at(-1)!.body!) as Array<{ metadata: { delivery_id: string; delivery_name: string } }>;
    expect(items[0].metadata.delivery_id).toBe(outra);
    expect(items[0].metadata.delivery_name).toBe('Entrega B');
    expect(items[1].metadata.delivery_id).toBe(DELIVERY);
    expect(items[1].metadata.delivery_name).toBe('Entrega A');
  });

  it('apaga as faturas rejeitadas do mesmo mês antes de inserir', async () => {
    queue = [reply(200, [{ id: 'old' }]), reply(204, ''), reply(204, ''), reply(201, [{ id: 'inv-4' }]), reply(201, '')];
    await runWrite(invoiceCmd());
    expect(calls[1]).toMatchObject({ method: 'DELETE' });
    expect(calls[1].url).toContain('invoice_items?invoice_id=in.(old)');
    expect(calls[2].url).toContain('invoices?id=in.(old)');
  });

  it('falha explicitamente quando o INSERT não devolve id', async () => {
    queue = [reply(200, []), reply(201, [])];
    await expect(runWrite(invoiceCmd())).rejects.toThrow('INSERT invoice não retornou id');
  });
});

// REGRESSÃO: o retry de 401 era da SEQUÊNCIA inteira. Um 401 no INSERT dos itens
// refazia tudo desde o começo — e como a fatura da 1ª tentativa nasce 'submitted'
// (o dedupe só apaga 'rejected'), sobravam DUAS faturas do mesmo mês, a primeira
// sem itens. Agora o refresh repete só a requisição que levou 401.
describe('invoice-create: 401 no meio da sequência', () => {
  it('repete só a requisição que falhou, sem inserir a fatura de novo', async () => {
    queue = [
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
    const itemInserts = calls.filter((c) => c.url.includes('/invoice_items'));
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
