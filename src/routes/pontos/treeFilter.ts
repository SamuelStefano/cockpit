import type { DflProjectNode, DflEpicNode, DflDeliveryNode, DflTaskStatus } from '../../../shared/protocol';

export type TreeFilter = 'all' | DflTaskStatus;

export interface DeliveryCounts { paid: number; open: number; todo: number }

export function deliveryCounts(d: DflDeliveryNode): DeliveryCounts {
  const c: DeliveryCounts = { paid: 0, open: 0, todo: 0 };
  for (const t of d.tasks) c[t.status]++;
  return c;
}

// Épico de 1 delivery com nome ~igual (comum no DFL: "X // Samuel" dentro de "X")
// vira ruído — o header do épico não acrescenta nada e some da UI.
export function redundantEpicHeader(ep: DflEpicNode): boolean {
  if (ep.deliveries.length !== 1) return false;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const e = norm(ep.name); const d = norm(ep.deliveries[0].name);
  return e !== '' && (d.startsWith(e) || e.startsWith(d));
}

export interface StatusPoints { paid: number; open: number; todo: number }

export function projectStatusPoints(p: DflProjectNode): StatusPoints {
  const s: StatusPoints = { paid: 0, open: 0, todo: 0 };
  for (const ep of p.epics) for (const d of ep.deliveries) for (const t of d.tasks) s[t.status] += t.points;
  return s;
}

// Filtra a árvore por status de task, podando delivery/épico/projeto que ficarem
// vazios. 'all' devolve a referência original (sem realocar).
export function filterProjects(projects: DflProjectNode[], filter: TreeFilter): DflProjectNode[] {
  if (filter === 'all') return projects;
  const out: DflProjectNode[] = [];
  for (const p of projects) {
    const epics = [];
    for (const ep of p.epics) {
      const deliveries = [];
      for (const d of ep.deliveries) {
        const tasks = d.tasks.filter((t) => t.status === filter);
        if (tasks.length) deliveries.push({ ...d, tasks });
      }
      if (deliveries.length) epics.push({ ...ep, deliveries });
    }
    if (epics.length) out.push({ ...p, epics });
  }
  return out;
}
