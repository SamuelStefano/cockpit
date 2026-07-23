import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { OWNER_ID, FELLOW_ID } from './dfl-sync';

const pexec = promisify(execFile);

// Canal de ESCRITA no DFL prod, espelho do dfl-sync (leitura): roda como processo
// FILHO com o token do Samuel na memória — o token NUNCA entra no processo do WS
// nem no cliente. Duas operações, cada uma pelo caminho SANCIONADO que a própria UI
// do DFL aperta:
//  - points-change → dispara o workflow BPMN dfl.work.task_points_change_request no
//    flows-api (handler service_role bypassa o RLS lock de work.tasks.points).
//  - invoice-create → INSERT em payments.invoices + invoice_items via PostgREST,
//    espelhando dfl-payments/useInvoiceCreation (fatura nasce 'submitted' → revisão).
// Identidade é FIXA no server (OWNER_ID/FELLOW_ID) — o comando do cliente nunca
// escolhe de quem é a fatura. Totais recomputados aqui, não confiados no cliente.
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

class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }

// Executa fn(creds); em 401 roda dfl-auth refresh e tenta UMA vez mais. NUNCA loga token.
async function withAuth<T>(fn: (c: Creds) => Promise<T>): Promise<T> {
  let creds = await loadCreds();
  try {
    return await fn(creds);
  } catch (e) {
    if (!(e instanceof HttpError) || e.status !== 401) throw e;
    await refreshToken();
    creds = await loadCreds();
    return await fn(creds);
  }
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
  return withAuth(async (creds) => {
    const res = await fetch(
      `${FLOWS_API}/engine-rest/process-definition/key/dfl.work.task_points_change_request/start?mode=sync`,
      { method: 'POST', headers: { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
    if (!res.ok) throw new HttpError(res.status, `flows ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const j = await res.json() as Record<string, unknown>;
    const vars = (j.variables ?? {}) as Record<string, unknown>;
    const applied = vars.applied === true || j.current_node_id === 'end';
    const rejected = j.current_node_id === 'end_rejected' || vars.applied === false;
    if (!applied || rejected) throw new Error(`workflow não aplicou (node=${String(j.current_node_id ?? '?')})`);
    return { applied: true, taskId: cmd.taskId, newPoints: Math.trunc(cmd.newPoints) };
  });
}

// ---- invoice-create: INSERT PostgREST, espelho de useInvoiceCreation --------

interface InvoiceTaskInput { id: string; title: string; points: number }
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

async function pgFetch(creds: Creds, path: string, init: RequestInit & { schema: string }): Promise<unknown> {
  const { schema, ...rest } = init;
  const method = (rest.method ?? 'GET').toUpperCase();
  const profileHeader = method === 'GET' ? { 'Accept-Profile': schema } : { 'Content-Profile': schema };
  const res = await fetch(`${creds.url}/rest/v1/${path}`, {
    ...rest,
    headers: {
      apikey: creds.anonKey, Authorization: `Bearer ${creds.token}`,
      'Content-Type': 'application/json', Accept: 'application/json',
      ...profileHeader, ...(rest.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) throw new HttpError(res.status, `PostgREST ${res.status} ${method} ${schema}/${path.split('?')[0]}: ${(await res.text()).slice(0, 300)}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

async function createInvoice(cmd: InvoiceCreateCmd): Promise<Record<string, unknown>> {
  if (!/^\d{4}-\d{2}$/.test(cmd.referenceMonth)) throw new Error('referenceMonth inválido (esperado YYYY-MM)');
  const tasks = cmd.tasks.filter((t) => Number.isFinite(t.points) && t.points > 0);
  if (tasks.length === 0) throw new Error('nenhuma task faturável (points > 0) na seleção');
  const ppp = Number.isFinite(cmd.pricePerPoint) && cmd.pricePerPoint > 0 ? cmd.pricePerPoint : 75;
  const toCents = (v: number) => Math.round(v * 100);
  const totalPoints = tasks.reduce((s, t) => s + t.points, 0);
  const totalAmountCents = tasks.reduce((s, t) => s + toCents(t.points * ppp), 0);
  const now = new Date().toISOString();
  const [yy, mm] = cmd.referenceMonth.split('-');
  const title = `Invoice ${['Samuel', cmd.projectName, cmd.deliveryName].filter(Boolean).join(' ')} - ${mm}${yy.slice(-2)}`;
  const projectId = cmd.projectId && uuidRe.test(cmd.projectId) ? cmd.projectId : null;
  const deliveryId = uuidRe.test(cmd.deliveryId) ? cmd.deliveryId : null;

  return withAuth(async (creds) => {
    // dedupe faturas 'rejected' do mesmo fellow/mês/org (igual ao app)
    const rejected = await pgFetch(creds,
      `invoices?fellow_user_id=eq.${FELLOW_ID}&reference_month=eq.${cmd.referenceMonth}&organization_id=eq.${ORG_ID}&status=eq.rejected&select=id`,
      { schema: 'payments' }) as { id: string }[];
    if (rejected?.length) {
      const ids = rejected.map((r) => r.id).join(',');
      await pgFetch(creds, `invoice_items?invoice_id=in.(${ids})`, { schema: 'payments', method: 'DELETE' });
      await pgFetch(creds, `invoices?id=in.(${ids})`, { schema: 'payments', method: 'DELETE' });
    }

    const payload = {
      fellow_user_id: FELLOW_ID, reference_month: cmd.referenceMonth, status: 'submitted',
      total_amount_cents: totalAmountCents, total_points: totalPoints, description: title,
      created_at: now, updated_at: now, submitted_at: now, submitted_by: FELLOW_ID, organization_id: ORG_ID,
    };
    const inserted = await pgFetch(creds, 'invoices?select=id', {
      schema: 'payments', method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload),
    }) as { id: string }[];
    const invoiceId = inserted?.[0]?.id;
    if (!invoiceId) throw new Error('INSERT invoice não retornou id');

    const items = tasks.map((t) => ({
      invoice_id: invoiceId, source_type: 'task', source_id: uuidRe.test(t.id) ? t.id : undefined,
      title: t.title, points: t.points, amount_cents: toCents(t.points * ppp),
      metadata: { project_id: projectId, points: t.points, value_per_point: ppp, delivery_id: deliveryId, delivery_name: cmd.deliveryName },
      created_at: now,
    }));
    await pgFetch(creds, 'invoice_items', { schema: 'payments', method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(items) });

    return { invoiceId, totalPoints, totalAmountCents, referenceMonth: cmd.referenceMonth, deliveryName: cmd.deliveryName };
  });
}

// ---- entrypoint ------------------------------------------------------------

type WriteCmd = PointsChangeCmd | InvoiceCreateCmd;

export async function runWrite(cmd: WriteCmd): Promise<Record<string, unknown>> {
  if (cmd.kind === 'points-change') return firePointsChange(cmd);
  if (cmd.kind === 'invoice-create') return createInvoice(cmd);
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
