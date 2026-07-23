import type { DflProjectNode } from '../../../shared/protocol';

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

const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Traduz a multi-seleção de deliveries em rascunhos de fatura, um por delivery
// (espelho do dfl-payments: uma invoice por delivery). Só entram tasks EM ABERTO
// (done, ainda não faturadas) — pago já tem fatura, a-fazer não é faturável. O valor
// vem do price_per_point da delivery (mesma base do amount que o snapshot mostra).
// Deliveries sem task aberta são descartadas.
export function invoiceDraftsFromSelection(
  projects: DflProjectNode[],
  selected: Set<string>,
  referenceMonth: string = monthKey(),
): InvoiceDraft[] {
  const drafts: InvoiceDraft[] = [];
  for (const project of projects) {
    for (const epic of project.epics) {
      for (const delivery of epic.deliveries) {
        if (!selected.has(delivery.id)) continue;
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
