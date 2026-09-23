import type { DflProjectNode, DflDeliveryNode, DflTaskStatus } from '../../../shared/protocol';

export type TreeFilter = 'all' | DflTaskStatus;

export interface DeliveryCounts { paid: number; open: number; todo: number }

export function deliveryCounts(d: DflDeliveryNode): DeliveryCounts {
  const c: DeliveryCounts = { paid: 0, open: 0, todo: 0 };
  for (const t of d.tasks) c[t.status]++;
  return c;
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
