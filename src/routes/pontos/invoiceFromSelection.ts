import type { DflProjectNode } from '../../../shared/protocol';
import { currentMonthKey } from './month-cap';

export interface InvoiceDraft {
  deliveryId: string;
  deliveryName: string;
  projectId: string;
  projectName: string;
  pricePerPoint: number;
  referenceMonth: string;      // YYYY-MM
  tasks: { id: string; title: string; points: number }[];
  points: number;
  amountCents: number;
}

// Mesmo mês de referência que a barra de teto usa (Brasília): com o mês do
// navegador, uma fatura podia nascer no mês seguinte ao que o teto estava medindo.
const monthKey = () => currentMonthKey(Date.now());

// Traduz a multi-seleção de deliveries em rascunhos de fatura, um por delivery
// (espelho do dfl-payments: uma invoice por delivery). Só entram tasks EM ABERTO
// (done, ainda não faturadas) — pago já tem fatura, a-fazer não é faturável. O valor
// vem do price_per_point da delivery (mesma base do amount que o snapshot mostra).
// Deliveries sem task aberta são descartadas.
export function invoiceDraftsFromSelection(
  projects: DflProjectNode[],
  selected: Set<string>,
  referenceMonth: string = monthKey(),
  // Deliveries marked "off" (work done that cannot be invoiced yet) never
  // become a draft, even when selected.
  excluded: ReadonlySet<string> = new Set(),
): InvoiceDraft[] {
  const drafts: InvoiceDraft[] = [];
  for (const project of projects) {
    for (const epic of project.epics) {
      for (const delivery of epic.deliveries) {
        if (!selected.has(delivery.id) || excluded.has(delivery.id)) continue;
        const open = delivery.tasks.filter((t) => t.status === 'open' && t.points > 0);
        if (open.length === 0) continue;
        const ppp = delivery.pricePerPoint > 0 ? delivery.pricePerPoint : 75;
        const points = open.reduce((s, t) => s + t.points, 0);
        drafts.push({
          deliveryId: delivery.id,
          deliveryName: delivery.name,
          projectId: project.id,
          projectName: project.name,
          pricePerPoint: ppp,
          referenceMonth,
          tasks: open.map((t) => ({ id: t.id, title: t.name, points: t.points })),
          points,
          amountCents: open.reduce((s, t) => s + Math.round(t.points * ppp * 100), 0),
        });
      }
    }
  }
  return drafts;
}

// What the selection bar shows next to "gerar invoice": the same drafts the
// invoice is built from (open tasks only, each delivery's own price).
export function selectionSummary(projects: DflProjectNode[], selected: Set<string>, excluded: ReadonlySet<string> = new Set()): { count: number; billable: number; points: number; amountCents: number } {
  let count = 0;
  for (const p of projects) for (const e of p.epics) for (const d of e.deliveries) if (selected.has(d.id)) count++;
  const drafts = invoiceDraftsFromSelection(projects, selected, monthKey(), excluded);
  return {
    count,
    billable: drafts.length,
    points: drafts.reduce((n, d) => n + d.points, 0),
    amountCents: drafts.reduce((n, d) => n + d.amountCents, 0),
  };
}
