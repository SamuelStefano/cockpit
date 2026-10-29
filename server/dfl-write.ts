import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DflTaskDbStatus } from '../shared/canvas';
import { OWNER_ID } from './dfl-sync';

const pexec = promisify(execFile);

// Canal de ESCRITA no DFL prod, espelho do dfl-sync (leitura): roda como processo
// FILHO com o token do Samuel na memória — o token NUNCA entra no processo do WS
// nem no cliente. Duas operações, pelo caminho SANCIONADO que a própria UI do DFL aperta:
//  - task-create/task-status → INSERT/PATCH em work.tasks via PostgREST, mesmo
//    schema que dfl-sync já LÊ (fetchDflBundle) — nunca points/valor: o vínculo
//    Kanban<->DFL (server/canvas/dfl-link.ts) só cria/move task, igual ao caminho
//    do dfl-work MCP (create_task/update_task).
// Identidade é FIXA no server (OWNER_ID) — o comando do cliente nunca escolhe de quem é a task.
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
// O retry é POR REQUISIÇÃO de propósito: reexecutar uma SEQUÊNCIA depois de um 401 no meio
// repetiria um INSERT que a primeira tentativa já gravou.
async function authedFetch(build: (c: Creds) => { url: string; init: RequestInit }): Promise<Response> {
  const first = build(await loadCreds());
  const res = await fetch(first.url, first.init);
  if (res.status !== 401) return res;
  await refreshToken();
  const retry = build(await loadCreds());
  return fetch(retry.url, retry.init);
}

async function pgFetch(path: string, init: RequestInit & { schema: string }): Promise<unknown> {
  const { schema, ...rest } = init;
  const method = (rest.method ?? 'GET').toUpperCase();
  const profileHeader = method === 'GET' ? { 'Accept-Profile': schema } : { 'Content-Profile': schema };
  const res = await authedFetch((creds) => ({
    url: `${creds.url}/rest/v1/${path}`,
    init: {
      ...rest,
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

type WriteCmd = TaskCreateCmd | TaskStatusCmd;

export async function runWrite(cmd: WriteCmd): Promise<Record<string, unknown>> {
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
