import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type {
  DflPointsSnapshot, DflProjectNode, DflEpicNode, DflDeliveryNode, DflTaskNode,
  DflInvoice, DflInvoiceItem, DflTotals, DflTaskStatus,
} from '../shared/protocol';

// Snapshot financeiro do DFL. A verdade é o DFL (work + payments); um sync roda
// dfl-auth+PostgREST FORA do request path e escreve o arquivo já filtrado só pro
// Samuel. Aqui só há a DOBRA PURA (foldDflTree) e a leitura do arquivo — zero
// segredo, zero rede no caminho de request. Path em runtime p/ ser testável.
export function dflSnapshotFile(): string {
  return process.env.COCKPIT_DFL_POINTS ?? join(homedir(), '.cockpit', 'dfl-points.json');
}

// Um sync mais velho que isto vira "stale" (badge na UI). Fail-closed: melhor
// mostrar número velho MARCADO do que cair pra query ao vivo (que traria segredo
// pro caminho de request). ~35 min cobre um cron de 15 min com folga.
export const STALE_MS = 35 * 60 * 1000;
export const DEFAULT_PRICE_PER_POINT = 75;

// Epics criados antes desta data são anteriores ao app de invoice — esse trabalho foi
// pago fora do app. Uma task done-sem-invoice num epic legado conta como PAGA (estimada),
// não aberta. Epic sem created_at (órfão) NÃO é legado: mantém o comportamento antigo.
export const LEGACY_EPIC_CUTOFF = '2026-07-01';
const isLegacyEpic = (createdAt?: string | null): boolean =>
  typeof createdAt === 'string' && createdAt < LEGACY_EPIC_CUTOFF;

// Linhas cruas do PostgREST (snake_case). O sync passa exatamente o que leu.
export interface DflRawInput {
  tasks: { id: string; name: string; status: string; points: number | null; epic_id: string | null; delivery_id: string | null }[];
  deliveries: { id: string; name: string; epic_id: string | null; status: string; price_per_point: number | null; transaction_id: string | null }[];
  epics: { id: string; name: string; project_id: string | null; status: string; created_at?: string | null }[];
  projects: { id: string; name: string }[];
  invoices: { id: string; reference_month: string; status: string; total_points: number | null; total_amount_cents: number | null; paid_at: string | null; transaction_id: string | null }[];
  invoiceItems: { invoice_id: string; source_id: string; points: number | null; amount_cents: number | null; title?: string | null }[];
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const round2 = (n: number): number => Math.round(n * 100) / 100;

// PURA: dobra os dados crus do DFL na árvore projeto›épico›delivery›task com
// classificação pago/aberto/a-fazer e totais. Reconciliação: uma task está PAGA se
// seu id aparece num invoice_item de invoice paga (source_id = task.id). ABERTA =
// done mas não faturada. A-FAZER = qualquer outro status. Valor da task paga vem do
// invoice_item (autoritativo); aberto/a-fazer estima points × price_per_point da
// delivery (fallback 75). Nós órfãos (delivery/épico/projeto ausente) caem em
// buckets "Sem …" pra nada sumir. Ordena por pontos desc em cada nível.
export function foldDflTree(input: DflRawInput, syncedAt: number): DflPointsSnapshot {
  const invById = new Map(input.invoices.map((i) => [i.id, i]));

  // task.id -> valor pago (cents) e pontos faturados, a partir dos itens de invoices pagas.
  // itemsByInvoice: linhas de CADA fatura (paga ou não) pra o detalhe expansível na UI.
  const paidCentsByTask = new Map<string, number>();
  const itemsByInvoice = new Map<string, DflInvoiceItem[]>();
  for (const it of input.invoiceItems) {
    const inv = invById.get(it.invoice_id);
    if (!inv) continue;
    if (inv.status === 'paid') paidCentsByTask.set(it.source_id, (paidCentsByTask.get(it.source_id) ?? 0) + num(it.amount_cents));
    const arr = itemsByInvoice.get(it.invoice_id) ?? [];
    arr.push({ title: it.title ?? 'Item', points: num(it.points), amountCents: num(it.amount_cents) });
    itemsByInvoice.set(it.invoice_id, arr);
  }

  const deliveryById = new Map(input.deliveries.map((d) => [d.id, d]));
  const epicById = new Map(input.epics.map((e) => [e.id, e]));
  const projectById = new Map(input.projects.map((p) => [p.id, p]));

  const pricePerPoint = (deliveryId: string | null): number => {
    const d = deliveryId ? deliveryById.get(deliveryId) : undefined;
    const p = d ? num(d.price_per_point) : 0;
    return p > 0 ? p : DEFAULT_PRICE_PER_POINT;
  };

  const NO_DELIVERY = '__no_delivery__';
  const NO_EPIC = '__no_epic__';
  const NO_PROJECT = '__no_project__';

  // Monta a árvore por chaves, depois materializa em nós ordenados.
  interface DeliveryAcc { id: string; name: string; status: string; pricePerPoint: number; transactionId?: string; tasks: DflTaskNode[] }
  interface EpicAcc { id: string; name: string; status: string; deliveries: Map<string, DeliveryAcc> }
  interface ProjectAcc { id: string; name: string; epics: Map<string, EpicAcc> }
  const projects = new Map<string, ProjectAcc>();

  let paidPoints = 0, paidAmountCents = 0, openPoints = 0, amountOpenCents = 0, todoPoints = 0;

  for (const t of input.tasks) {
    const points = num(t.points);

    const delId = t.delivery_id ?? NO_DELIVERY;
    const del = t.delivery_id ? deliveryById.get(t.delivery_id) : undefined;
    const epicId = del?.epic_id ?? t.epic_id ?? NO_EPIC;
    const epic = epicId !== NO_EPIC ? epicById.get(epicId) : undefined;
    const projId = epic?.project_id ?? NO_PROJECT;
    const proj = projId !== NO_PROJECT ? projectById.get(projId) : undefined;

    const paidCents = paidCentsByTask.get(t.id);
    let status: DflTaskStatus;
    let amountCents: number;
    if (paidCents !== undefined) {
      status = 'paid';
      amountCents = paidCents;
      paidPoints += points; paidAmountCents += paidCents;
    } else if (t.status === 'done') {
      amountCents = Math.round(points * pricePerPoint(t.delivery_id) * 100);
      if (isLegacyEpic(epic?.created_at)) {
        status = 'paid';
        paidPoints += points; paidAmountCents += amountCents;
      } else {
        status = 'open';
        openPoints += points; amountOpenCents += amountCents;
      }
    } else {
      status = 'todo';
      amountCents = Math.round(points * pricePerPoint(t.delivery_id) * 100);
      todoPoints += points;
    }

    let pAcc = projects.get(projId);
    if (!pAcc) { pAcc = { id: projId, name: proj?.name ?? 'Sem projeto', epics: new Map() }; projects.set(projId, pAcc); }
    let eAcc = pAcc.epics.get(epicId);
    if (!eAcc) { eAcc = { id: epicId, name: epic?.name ?? 'Sem épico', status: epic?.status ?? '', deliveries: new Map() }; pAcc.epics.set(epicId, eAcc); }
    let dAcc = eAcc.deliveries.get(delId);
    if (!dAcc) {
      dAcc = { id: delId, name: del?.name ?? 'Sem delivery', status: del?.status ?? '', pricePerPoint: pricePerPoint(t.delivery_id), transactionId: del?.transaction_id ?? undefined, tasks: [] };
      eAcc.deliveries.set(delId, dAcc);
    }
    dAcc.tasks.push({ id: t.id, name: t.name, points, status, rawStatus: t.status, amountCents });
  }

  const projectNodes: DflProjectNode[] = [];
  for (const p of projects.values()) {
    const epicNodes: DflEpicNode[] = [];
    for (const e of p.epics.values()) {
      const delNodes: DflDeliveryNode[] = [];
      for (const d of e.deliveries.values()) {
        const tasks = d.tasks.sort((a, b) => b.points - a.points);
        const dp = round2(tasks.reduce((s, x) => s + x.points, 0));
        const dc = tasks.reduce((s, x) => s + x.amountCents, 0);
        delNodes.push({ id: d.id, name: d.name, status: d.status, pricePerPoint: d.pricePerPoint, transactionId: d.transactionId, tasks, points: dp, amountCents: dc });
      }
      delNodes.sort((a, b) => b.points - a.points);
      const ep = round2(delNodes.reduce((s, x) => s + x.points, 0));
      const ec = delNodes.reduce((s, x) => s + x.amountCents, 0);
      epicNodes.push({ id: e.id, name: e.name, status: e.status, deliveries: delNodes, points: ep, amountCents: ec });
    }
    epicNodes.sort((a, b) => b.points - a.points);
    const pp = round2(epicNodes.reduce((s, x) => s + x.points, 0));
    const pc = epicNodes.reduce((s, x) => s + x.amountCents, 0);
    projectNodes.push({ id: p.id, name: p.name, epics: epicNodes, points: pp, amountCents: pc });
  }
  projectNodes.sort((a, b) => b.points - a.points);

  const invoices: DflInvoice[] = input.invoices
    .map((i) => ({ id: i.id, referenceMonth: i.reference_month, status: i.status, totalPoints: num(i.total_points), totalAmountCents: num(i.total_amount_cents), paidAt: i.paid_at, transactionId: i.transaction_id, items: (itemsByInvoice.get(i.id) ?? []).sort((a, b) => b.points - a.points) }))
    .sort((a, b) => (a.referenceMonth < b.referenceMonth ? 1 : a.referenceMonth > b.referenceMonth ? -1 : 0));

  const totals: DflTotals = {
    paidPoints: round2(paidPoints),
    paidAmountCents,
    openPoints: round2(openPoints),
    amountOpenCents,
    todoPoints: round2(todoPoints),
    totalPoints: round2(paidPoints + openPoints + todoPoints),
  };

  return { projects: projectNodes, invoices, totals, pricePerPoint: DEFAULT_PRICE_PER_POINT, syncedAt, stale: false };
}

export function deriveStale(syncedAt: number, now: number): boolean {
  return now - syncedAt > STALE_MS;
}

// Lê o snapshot do arquivo e re-deriva `stale` no momento da leitura (o arquivo
// carrega o syncedAt; a idade é sempre relativa ao AGORA). null = sync nunca rodou
// ou arquivo corrompido — fail-closed, a UI trata como "sem dados", nunca busca ao vivo.
export async function readDflSnapshot(now: number = Date.now()): Promise<DflPointsSnapshot | null> {
  let raw: string;
  try { raw = await readFile(dflSnapshotFile(), 'utf8'); } catch { return null; }
  try {
    const s = JSON.parse(raw) as DflPointsSnapshot;
    if (!s || typeof s.syncedAt !== 'number' || !Array.isArray(s.projects)) return null;
    return { ...s, stale: deriveStale(s.syncedAt, now) };
  } catch { return null; }
}
