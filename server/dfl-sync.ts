import { readFile, writeFile, rename, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DflPointsSnapshot } from '../shared/protocol';
import { foldDflTree, dflSnapshotFile, type DflRawInput } from './dfl-points';

const pexec = promisify(execFile);

// Sincronizador do snapshot financeiro do DFL. Roda FORA do request path (cron do
// usuário samuel): autentica com dfl-auth, lê work+payments via PostgREST FILTRADO
// pelas identidades do Samuel, dobra em árvore e escreve ~/.cockpit/dfl-points.json
// (write atômico). O Deck só lê o arquivo — o token NUNCA cruza pro processo do WS
// nem pro cliente. Duas identidades distintas do mesmo Samuel: owner_id (work) e
// fellow_user_id (payments) — ver plano 20260722-deck-pontos-financeiro.
export const OWNER_ID = process.env.DFL_OWNER_ID ?? 'ef7d8a76-9549-4ddc-ae68-73099226d9c0';
export const FELLOW_ID = process.env.DFL_FELLOW_ID ?? 'b0e42ca3-f246-4888-a3eb-c3292e2f2b31';

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

// GET no PostgREST de um schema custom (Accept-Profile). Lança em não-2xx pra o
// caller decidir refresh (401) ou falha dura. NUNCA loga o token.
async function pgGet(creds: Creds, schema: string, pathAndQuery: string): Promise<unknown[]> {
  const res = await fetch(`${creds.url}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: creds.anonKey, Authorization: `Bearer ${creds.token}`, 'Accept-Profile': schema, Accept: 'application/json' },
  });
  if (!res.ok) { const e = new Error(`PostgREST ${res.status} em ${schema}/${pathAndQuery.split('?')[0]}`) as Error & { status?: number }; e.status = res.status; throw e; }
  const j = await res.json();
  if (!Array.isArray(j)) throw new Error('resposta PostgREST não é array');
  return j;
}

type RawTask = DflRawInput['tasks'][number] & { owner_id: string };
type RawDelivery = DflRawInput['deliveries'][number] & { owner_id: string };
type RawInvoice = DflRawInput['invoices'][number] & { fellow_user_id: string };

interface RawBundle {
  tasks: RawTask[];
  deliveries: RawDelivery[];
  epics: DflRawInput['epics'];
  projects: DflRawInput['projects'];
  invoices: RawInvoice[];
  invoiceItems: DflRawInput['invoiceItems'];
}

// Busca os 6 datasets, cada um FILTRADO na origem pelas identidades do Samuel.
export async function fetchDflBundle(creds: Creds): Promise<RawBundle> {
  const tasks = await pgGet(creds, 'work', `tasks?owner_id=eq.${OWNER_ID}&select=id,name,status,points,epic_id,delivery_id,owner_id`) as RawTask[];
  const deliveries = await pgGet(creds, 'work', `deliveries?owner_id=eq.${OWNER_ID}&select=id,name,epic_id,status,price_per_point,transaction_id,owner_id`) as RawDelivery[];
  const epicIds = [...new Set([...tasks.map((t) => t.epic_id), ...deliveries.map((d) => d.epic_id)].filter(Boolean))] as string[];
  const epics = epicIds.length ? await pgGet(creds, 'work', `epics?id=in.(${epicIds.join(',')})&select=id,name,project_id,status,created_at`) as DflRawInput['epics'] : [];
  const projectIds = [...new Set(epics.map((e) => e.project_id).filter(Boolean))] as string[];
  const projects = projectIds.length ? await pgGet(creds, 'work', `projects?id=in.(${projectIds.join(',')})&select=id,name`) as DflRawInput['projects'] : [];
  const invoices = await pgGet(creds, 'payments', `invoices?fellow_user_id=eq.${FELLOW_ID}&select=id,reference_month,status,total_points,total_amount_cents,paid_at,transaction_id,fellow_user_id`) as RawInvoice[];
  const invoiceItems = invoices.length
    ? await pgGet(creds, 'payments', `invoice_items?invoice_id=in.(${invoices.map((i) => i.id).join(',')})&select=invoice_id,source_id,points,amount_cents`) as DflRawInput['invoiceItems']
    : [];
  return { tasks, deliveries, epics, projects, invoices, invoiceItems };
}

// Guard de contrato: NENHUM id de outro fellow/owner pode entrar no snapshot. A
// query já filtra na origem, mas re-verificamos no cliente antes de escrever —
// fail-closed. Se um dia o filtro quebrar, o arquivo não nasce vazado.
export function assertOwnedBy(b: RawBundle, ids: { ownerId: string; fellowId: string } = { ownerId: OWNER_ID, fellowId: FELLOW_ID }): void {
  const badTask = b.tasks.find((t) => t.owner_id !== ids.ownerId);
  if (badTask) throw new Error(`contrato violado: task ${badTask.id} não é do Samuel`);
  const badDel = b.deliveries.find((d) => d.owner_id !== ids.ownerId);
  if (badDel) throw new Error(`contrato violado: delivery ${badDel.id} não é do Samuel`);
  const badInv = b.invoices.find((i) => i.fellow_user_id !== ids.fellowId);
  if (badInv) throw new Error(`contrato violado: invoice ${badInv.id} não é do Samuel`);
}

// Strip dos campos de owner: o snapshot só carrega o necessário pra UI.
export function toFoldInput(b: RawBundle): DflRawInput {
  return {
    tasks: b.tasks.map(({ owner_id: _o, ...t }) => t),
    deliveries: b.deliveries.map(({ owner_id: _o, ...d }) => d),
    epics: b.epics, projects: b.projects,
    invoices: b.invoices.map(({ fellow_user_id: _f, ...i }) => i),
    invoiceItems: b.invoiceItems,
  };
}

// Write atômico: escreve no .tmp e renomeia (rename é atômico no mesmo fs) — um
// leitor via fs.watch nunca vê arquivo meio-escrito. 0600 por ser dado financeiro.
export async function writeSnapshotAtomic(snap: DflPointsSnapshot): Promise<void> {
  const f = dflSnapshotFile();
  await mkdir(dirname(f), { recursive: true });
  const tmp = `${f}.tmp`;
  await writeFile(tmp, JSON.stringify(snap), { encoding: 'utf8', mode: 0o600 });
  await rename(tmp, f);
  await chmod(f, 0o600).catch(() => {});
}

// dfl-auth refresh (Q2=A: cron auto-refresha sem intervenção). Best-effort: se o
// binário faltar ou falhar, o retry vai falhar com 401 e o sync marca stale.
async function refreshToken(): Promise<void> {
  try { await pexec('dfl-auth', ['refresh'], { timeout: 30_000 }); } catch { /* retry decide */ }
}

// Um ciclo de sync. Tenta com o token atual; em 401 roda dfl-auth refresh e tenta
// UMA vez mais. Retorna o snapshot escrito.
export async function syncOnce(now: number = Date.now()): Promise<DflPointsSnapshot> {
  let creds = await loadCreds();
  let bundle: RawBundle;
  try {
    bundle = await fetchDflBundle(creds);
  } catch (e) {
    if ((e as { status?: number }).status !== 401) throw e;
    await refreshToken();
    creds = await loadCreds();
    bundle = await fetchDflBundle(creds);
  }
  assertOwnedBy(bundle);
  const snap = foldDflTree(toFoldInput(bundle), now);
  await writeSnapshotAtomic(snap);
  return snap;
}

// Entrypoint do cron: `tsx server/dfl-sync.ts`. Loga só contagens (nunca token).
async function main() {
  const snap = await syncOnce();
  const t = snap.totals;
  process.stdout.write(`dfl-sync ok: ${snap.projects.length} projetos, pago ${t.paidPoints}pts/R$${(t.paidAmountCents / 100).toFixed(2)}, aberto ${t.openPoints}pts, a-fazer ${t.todoPoints}pts\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { process.stderr.write(`dfl-sync falhou: ${e?.message ?? e}\n`); process.exit(1); });
}
