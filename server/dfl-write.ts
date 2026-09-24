import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DflTaskDbStatus } from '../shared/canvas';
import { OWNER_ID, FELLOW_ID } from './dfl-sync';

const pexec = promisify(execFile);

// Canal de ESCRITA no DFL prod, espelho do dfl-sync (leitura): roda como processo
// FILHO com o token do Samuel na memória — o token NUNCA entra no processo do WS
// nem no cliente. Quatro operações, cada uma pelo caminho SANCIONADO que a própria
// UI do DFL aperta:
//  - points-change → dispara o workflow BPMN dfl.work.task_points_change_request no
//    flows-api (handler service_role bypassa o RLS lock de work.tasks.points).
//  - invoice-create → INSERT em payments.invoices + invoice_items via PostgREST,
//    espelhando dfl-payments/useInvoiceCreation (fatura nasce 'submitted' → revisão).
//  - task-create/task-status → INSERT/PATCH em work.tasks via PostgREST, mesmo
//    schema que dfl-sync já LÊ (fetchDflBundle) — nunca points/valor: o vínculo
//    Kanban<->DFL (server/canvas/dfl-link.ts) só cria/move task, igual ao caminho
//    do dfl-work MCP (create_task/update_task), nunca a rota financeira acima.
// Identidade é FIXA no server (OWNER_ID/FELLOW_ID) — o comando do cliente nunca
// escolhe de quem é a fatura/task. Totais recomputados aqui, não confiados no cliente.
const FLOWS_API = process.env.DFL_FLOWS_API ?? 'https://flows-api.devfellowship.com';
const ORG_ID = process.env.DFL_ORG_ID ?? '35408dc3-508e-455b-8684-e96cea72f573';
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESULT_MARK = 'DFL_WRITE_RESULT:';

interface Creds { url: string; anonKey: string; token: string }

function credsPath(): string { return process.env.DFL_MCP_DIR ?? join(homedir(), '.dfl-mcp'); }

async function loadCreds(): Promise<Creds> {
  const dir = credsPath();
  const proj = JSON.parse(await readFile(join(dir, 'project.json'), 'utf8'));
  const cred = JSON.parse(await readFile(join(dir, 'credentials.json'), 'utf8'));
  const token = cred.access_token;
  if (!proj.supabase_url || !proj.supabase_anon_key || !token) throw new Error('dfl-mcp creds incompletos');
  return { url: proj.supabase_url, anonKey: proj.supabase_anon_key, token };
}

async function refreshToken(): Promise<void> {
  try { await pexec('dfl-auth', ['refresh'], { timeout: 30_000 }); } catch { /* retry decide */ }
}

// UMA requisição autenticada, com um retry após `dfl-auth refresh` no 401. NUNCA loga token.
// O retry é POR REQUISIÇÃO de propósito: criar um invoice são cinco chamadas em
// sequência, e reexecutar a SEQUÊNCIA inteira depois de um 401 no meio repetiria o
// INSERT do invoice que a primeira tentativa já gravou — ele nasce 'submitted' e o
// dedupe só apaga 'rejected'. Sobrariam duas faturas do mesmo mês, a primeira sem itens.
async function authedFetch(build: (c: Creds) => { url: string; init: RequestInit }): Promise<Response> {
  const first = build(await loadCreds());
  const res = await fetch(first.url, first.init);
  if (res.status !== 401) return res;
  await refreshToken();
  const retry = build(await loadCreds());
  return fetch(retry.url, retry.init);
}

// ---- points-change: workflow BPMN sancionado -------------------------------

interface PointsChangeCmd {
  kind: 'points-change';
  taskId: string;
  taskName: string;
  currentPoints: number;
  newPoints: number;
  reason?: string;
}

async function firePointsChange(cmd: PointsChangeCmd): Promise<Record<string, unknown>> {
  if (!uuidRe.test(cmd.taskId)) throw new Error('taskId inválido');
  if (!Number.isFinite(cmd.newPoints) || cmd.newPoints < 0) throw new Error('newPoints inválido');
  const cur = Number.isFinite(cmd.currentPoints) ? cmd.currentPoints : 0;
  const diffPercent = cur > 0 ? Math.abs((cmd.newPoints - cur) / cur) * 100 : 100;
  const body = {
    mode: 'sync',
    variables: {
      target_id: cmd.taskId,
      requester_user_id: OWNER_ID,
      role: 'admin',
      diff_percent: diffPercent,
      payload: {
        new_points: Math.trunc(cmd.newPoints),
        task_name: cmd.taskName,
        reason: cmd.reason?.trim() || 'Ajuste via Deck /pontos',
      },
    },
  };
  const res = await authedFetch((creds) => ({
    url: `${FLOWS_API}/engine-rest/process-definition/key/dfl.work.task_points_change_request/start?mode=sync`,
    init: { method: 'POST', headers: { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  }));
  if (!res.ok) throw new Error(`flows ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json() as Record<string, unknown>;
  const vars = (j.variables ?? {}) as Record<string, unknown>;
  const applied = vars.applied === true || j.current_node_id === 'end';
  const rejected = j.current_node_id === 'end_rejected' || vars.applied === false;
  if (!applied || rejected) throw new Error(`workflow não aplicou (node=${String(j.current_node_id ?? '?')})`);
  return { applied: true, taskId: cmd.taskId, newPoints: Math.trunc(cmd.newPoints) };
}

// ---- invoice-create: INSERT PostgREST, espelho de useInvoiceCreation --------

// deliveryId/deliveryName por task: `metadata.delivery_id` não é informativo — o
// gerador de invoice (billed-deliveries) usa ele pra esconder delivery já faturada,
// então um invoice que junta tasks de duas deliveries precisa estampar a de cada uma,
// senão a outra volta a parecer não faturada e é cobrada de novo.
interface InvoiceTaskInput {
  id: string;
  title: string;
  points: number;
  deliveryId?: string;
  deliveryName?: string;
}
interface InvoiceCreateCmd {
  kind: 'invoice-create';
  deliveryId: string;
  deliveryName: string;
  projectId?: string | null;
  projectName?: string | null;
  referenceMonth: string;       // YYYY-MM
  pricePerPoint: number;
  tasks: InvoiceTaskInput[];
}

const PG_TIMEOUT_MS = 20_000;
// The runner kills this process at 60s. Everything before the INSERT (guards,
// rejected cleanup) must finish inside PRE_INSERT_BUDGET_MS, or nothing is
// written; the INSERT, the items and a rollback then get short fixed timeouts,
// so the two writes can't be split by the kill.
const PRE_INSERT_BUDGET_MS = 30_000;
const WRITE_TIMEOUT_MS = 8_000;
const ROLLBACK_TIMEOUT_MS = 5_000;

const isTimeout = (e: unknown) => e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');

async function pgFetch(path: string, init: RequestInit & { schema: string; timeoutMs?: number }): Promise<unknown> {
  const { schema, timeoutMs = PG_TIMEOUT_MS, ...rest } = init;
  const method = (rest.method ?? 'GET').toUpperCase();
  const profileHeader = method === 'GET' ? { 'Accept-Profile': schema } : { 'Content-Profile': schema };
  const res = await authedFetch((creds) => ({
    url: `${creds.url}/rest/v1/${path}`,
    init: {
      ...rest,
      // The runner kills this process at 60s. A hung request must fail first,
      // or the kill lands between two writes of the invoice sequence.
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        apikey: creds.anonKey, Authorization: `Bearer ${creds.token}`,
        'Content-Type': 'application/json', Accept: 'application/json',
        ...profileHeader, ...(rest.headers as Record<string, string> | undefined),
      },
    },
  }));
  if (!res.ok) throw new Error(`PostgREST ${res.status} ${method} ${schema}/${path.split('?')[0]}: ${(await res.text()).slice(0, 300)}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

async function assertNotInvoiced(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;
  const items = await pgFetch(
    `invoice_items?source_type=eq.task&source_id=in.(${taskIds.join(',')})&select=invoice_id,source_id`,
    { schema: 'payments' }) as { invoice_id: string; source_id: string }[] | null;
  const invoiceIds = [...new Set((items ?? []).map((i) => i.invoice_id))];
  if (invoiceIds.length === 0) return;
  const live = await pgFetch(
    `invoices?id=in.(${invoiceIds.join(',')})&status=neq.rejected&select=id,status`,
    { schema: 'payments' }) as { id: string; status: string }[] | null;
  if (!live?.length) return;
  const liveIds = new Set(live.map((i) => i.id));
  const billed = new Set((items ?? []).filter((i) => liveIds.has(i.invoice_id)).map((i) => i.source_id));
  throw new Error(`${billed.size} task(s) já estão numa fatura ${live.map((i) => i.status).join('/')} — não faturo de novo`);
}

// An invoice left without items (a rollback that could not delete it) matches no
// task, so assertNotInvoiced can't see it; a new invoice for the same month would
// sit next to it. Refuse while one exists.
async function assertNoEmptyInvoice(referenceMonth: string): Promise<void> {
  // Two plain queries, not an embedded select: no dependency on how the FK
  // between invoice_items and invoices is exposed.
  const live = await pgFetch(
    `invoices?fellow_user_id=eq.${FELLOW_ID}&reference_month=eq.${referenceMonth}&organization_id=eq.${ORG_ID}&status=neq.rejected&select=id`,
    { schema: 'payments' }) as { id: string }[] | null;
  if (!live?.length) return;
  const items = await pgFetch(
    `invoice_items?invoice_id=in.(${live.map((i) => i.id).join(',')})&select=invoice_id`,
    { schema: 'payments' }) as { invoice_id: string }[] | null;
  const withItems = new Set((items ?? []).map((i) => i.invoice_id));
  const empty = live.filter((i) => !withItems.has(i.id));
  if (empty.length) throw new Error(`a fatura ${empty.map((i) => i.id).join(', ')} de ${referenceMonth} está vazia no DFL — apague-a lá antes de gerar outra`);
}

async function createInvoice(cmd: InvoiceCreateCmd): Promise<Record<string, unknown>> {
  if (!/^\d{4}-\d{2}$/.test(cmd.referenceMonth)) throw new Error('referenceMonth inválido (esperado YYYY-MM)');
  const tasks = cmd.tasks.filter((t) => Number.isFinite(t.points) && t.points > 0);
  if (tasks.length === 0) throw new Error('nenhuma task faturável (points > 0) na seleção');
  if (new Set(tasks.map((t) => t.id)).size !== tasks.length) throw new Error('task repetida na seleção');
  const ppp = Number.isFinite(cmd.pricePerPoint) && cmd.pricePerPoint > 0 ? cmd.pricePerPoint : 75;
  const toCents = (v: number) => Math.round(v * 100);
  const totalPoints = tasks.reduce((s, t) => s + t.points, 0);
  const totalAmountCents = tasks.reduce((s, t) => s + toCents(t.points * ppp), 0);
  const now = new Date().toISOString();
  const [yy, mm] = cmd.referenceMonth.split('-');
  const title = `Invoice ${['Samuel', cmd.projectName, cmd.deliveryName].filter(Boolean).join(' ')} - ${mm}${yy.slice(-2)}`;
  const projectId = cmd.projectId && uuidRe.test(cmd.projectId) ? cmd.projectId : null;
  const deliveryId = uuidRe.test(cmd.deliveryId) ? cmd.deliveryId : null;

  // A done task on a submitted/approved/payment_requested invoice still folds as
  // `open` on /pontos, and the tab-local guard (#582) is gone after a reload. The
  // server is the only place that sees every invoice, so it refuses here.
  const startedAt = Date.now();
  await assertNotInvoiced(tasks.map((t) => t.id).filter((id) => uuidRe.test(id)));
  await assertNoEmptyInvoice(cmd.referenceMonth);

  // dedupe faturas 'rejected' do mesmo fellow/mês/org (igual ao app)
  const rejected = await pgFetch(
    `invoices?fellow_user_id=eq.${FELLOW_ID}&reference_month=eq.${cmd.referenceMonth}&organization_id=eq.${ORG_ID}&status=eq.rejected&select=id`,
    { schema: 'payments' }) as { id: string }[];
  if (rejected?.length) {
    const ids = rejected.map((r) => r.id).join(',');
    await pgFetch(`invoice_items?invoice_id=in.(${ids})`, { schema: 'payments', method: 'DELETE' });
    await pgFetch(`invoices?id=in.(${ids})`, { schema: 'payments', method: 'DELETE' });
  }

  const payload = {
    fellow_user_id: FELLOW_ID, reference_month: cmd.referenceMonth, status: 'submitted',
    total_amount_cents: totalAmountCents, total_points: totalPoints, description: title,
    created_at: now, updated_at: now, submitted_at: now, submitted_by: FELLOW_ID, organization_id: ORG_ID,
  };
  if (Date.now() - startedAt > PRE_INSERT_BUDGET_MS) throw new Error('DFL lento demais — nada foi gravado; tente de novo');
  let inserted: { id: string }[];
  try {
    inserted = await pgFetch('invoices?select=id', {
      schema: 'payments', method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload), timeoutMs: WRITE_TIMEOUT_MS,
    }) as { id: string }[];
  } catch (e) {
    // No reply to the INSERT: it may or may not have committed. Say so instead of
    // a plain failure, so nobody retries into a second invoice.
    if (isTimeout(e)) throw new Error('sem resposta do DFL ao criar a fatura — ela pode ter sido criada; confira no DFL antes de gerar de novo');
    throw e;
  }
  const invoiceId = inserted?.[0]?.id;
  if (!invoiceId) throw new Error('INSERT invoice não retornou id');

  const items = tasks.map((t) => ({
    invoice_id: invoiceId, source_type: 'task', source_id: uuidRe.test(t.id) ? t.id : undefined,
    title: t.title, points: t.points, amount_cents: toCents(t.points * ppp),
    metadata: {
      project_id: projectId, points: t.points, value_per_point: ppp,
      delivery_id: t.deliveryId && uuidRe.test(t.deliveryId) ? t.deliveryId : deliveryId,
      delivery_name: t.deliveryName ?? cmd.deliveryName,
    },
    created_at: now,
  }));
  try {
    await pgFetch('invoice_items', { schema: 'payments', method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(items), timeoutMs: WRITE_TIMEOUT_MS });
  } catch (e) {
    // Without items the invoice is a submitted shell whose total matches nothing,
    // and a retry would add a second one for the same month. Remove it, and CHECK
    // that a row went: under RLS a DELETE the fellow may not do answers 204 with
    // zero rows, which used to pass as a successful rollback.
    await pgFetch(`invoice_items?invoice_id=eq.${invoiceId}`, { schema: 'payments', method: 'DELETE', timeoutMs: ROLLBACK_TIMEOUT_MS }).catch(() => {});
    const removed = await pgFetch(`invoices?id=eq.${invoiceId}&select=id`, {
      schema: 'payments', method: 'DELETE', headers: { Prefer: 'return=representation' }, timeoutMs: ROLLBACK_TIMEOUT_MS,
    }).catch(() => null) as { id: string }[] | null;
    const why = (e as Error).message;
    if (!removed?.length) throw new Error(`itens não gravaram (${why}) e a fatura ${invoiceId} ficou vazia no DFL — apague-a lá antes de gerar de novo`);
    throw e;
  }

  return { invoiceId, totalPoints, totalAmountCents, referenceMonth: cmd.referenceMonth, deliveryName: cmd.deliveryName };
}

// ---- task-create / task-status: INSERT/PATCH em work.tasks -----------------

const MAX_TASK_NAME = 200;
const MAX_CONTEXT_FIELD = 2000;
const TASK_STAGE_ID = 'execution'; // dfl-work create_task schema: work ready to be built
const TASK_STATUSES = new Set<DflTaskDbStatus>(['to_do', 'in_progress', 'dev_completed', 'done', 'no_longer_needed', 'blocked']);

interface TaskCreateCmd {
  kind: 'task-create';
  epicId: string;
  deliveryId: string;
  taskName: string;
  // Mirrors the dfl-work MCP's create_task REQUIRED context.why/what (both
  // non-empty there too) — an orphan task with no why/what is unreadable to
  // whoever didn't see the Deck card that spawned it. Explicit, user-typed
  // text ONLY (server/ws/dispatch.ts never fills this from a card's raw
  // prompt — that would leak whatever the card's agent instructions say,
  // including anything personal, straight into a DFL-visible task).
  why: string;
  what: string;
}
interface TaskStatusCmd {
  kind: 'task-status';
  taskId: string;
  status: DflTaskDbStatus;
}

async function createTask(cmd: TaskCreateCmd): Promise<Record<string, unknown>> {
  if (!uuidRe.test(cmd.epicId)) throw new Error('epicId inválido');
  if (!uuidRe.test(cmd.deliveryId)) throw new Error('deliveryId inválido');
  const name = cmd.taskName.trim().slice(0, MAX_TASK_NAME);
  if (!name) throw new Error('taskName vazio');
  const why = cmd.why.trim().slice(0, MAX_CONTEXT_FIELD);
  const what = cmd.what.trim().slice(0, MAX_CONTEXT_FIELD);
  if (!why || !what) throw new Error('why/what vazios (contexto mínimo é obrigatório)');
  const now = new Date().toISOString();
  const payload = {
    name, status: 'to_do', stage_id: TASK_STAGE_ID, owner_id: OWNER_ID,
    epic_id: cmd.epicId, delivery_id: cmd.deliveryId,
    description: `Por que: ${why}\n\nO que: ${what}`,
    created_at: now, updated_at: now,
  };
  const inserted = await pgFetch('tasks?select=id,name,status', {
    schema: 'work', method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload),
  }) as { id: string; name: string; status: string }[];
  const taskId = inserted?.[0]?.id;
  if (!taskId) throw new Error('INSERT task não retornou id');
  return { taskId, name: inserted[0].name, status: inserted[0].status };
}

async function updateTaskStatus(cmd: TaskStatusCmd): Promise<Record<string, unknown>> {
  if (!uuidRe.test(cmd.taskId)) throw new Error('taskId inválido');
  if (!TASK_STATUSES.has(cmd.status)) throw new Error('status inválido');
  const now = new Date().toISOString();
  // Prefer return=representation: se o PATCH não achar a linha (task apagada/id
  // errado), a resposta vem [] e viramos erro explícito — nunca um "sucesso" mudo.
  // select inclui updated_at: server/canvas/dfl-status-sync.ts precisa dele pra
  // manter o "relógio DFL" do link alinhado com o que o PATCH realmente gravou,
  // em vez de reconstruir a partir de um `now` local que pode divergir por ms.
  const updated = await pgFetch(`tasks?id=eq.${cmd.taskId}&select=id,status,updated_at`, {
    schema: 'work', method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: cmd.status, updated_at: now }),
  }) as { id: string; status: string; updated_at: string }[];
  if (!updated?.length) throw new Error('PATCH task não achou a linha (id inválido ou sem permissão)');
  return { taskId: cmd.taskId, status: updated[0].status, updatedAt: updated[0].updated_at };
}

// ---- entrypoint ------------------------------------------------------------

type WriteCmd = PointsChangeCmd | InvoiceCreateCmd | TaskCreateCmd | TaskStatusCmd;

export async function runWrite(cmd: WriteCmd): Promise<Record<string, unknown>> {
  if (cmd.kind === 'points-change') return firePointsChange(cmd);
  if (cmd.kind === 'invoice-create') return createInvoice(cmd);
  if (cmd.kind === 'task-create') return createTask(cmd);
  if (cmd.kind === 'task-status') return updateTaskStatus(cmd);
  throw new Error(`comando desconhecido: ${(cmd as { kind: string }).kind}`);
}

async function main() {
  const raw = process.argv[2];
  if (!raw) throw new Error('faltou o comando JSON no argv[2]');
  const cmd = JSON.parse(raw) as WriteCmd;
  const result = await runWrite(cmd);
  process.stdout.write(`${RESULT_MARK}${JSON.stringify(result)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { process.stderr.write(`dfl-write falhou: ${e?.message ?? e}\n`); process.exit(1); });
}

export { RESULT_MARK };
