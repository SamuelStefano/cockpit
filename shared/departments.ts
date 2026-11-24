export type DepartmentId = 'direction' | 'engineering' | 'growth' | 'finance' | 'operations';

export interface Department { id: DepartmentId; name: string; color: string }

export const DEPARTMENTS: readonly Department[] = [
  { id: 'direction', name: 'Direção', color: '#f97316' },
  { id: 'engineering', name: 'Engenharia', color: '#3b82f6' },
  { id: 'growth', name: 'Growth', color: '#ec4899' },
  { id: 'finance', name: 'Finanças', color: '#22c55e' },
  { id: 'operations', name: 'Operações', color: '#eab308' },
];

export function isDepartmentId(v: unknown): v is DepartmentId {
  return typeof v === 'string' && DEPARTMENTS.some((d) => d.id === v);
}

export function departmentById(id: DepartmentId | undefined): Department | null {
  return DEPARTMENTS.find((d) => d.id === id) ?? null;
}

export interface DepartmentGroup<T> { department: Department | null; items: T[] }

export function groupByDepartment<T>(items: T[], departmentOf: (t: T) => DepartmentId | undefined): DepartmentGroup<T>[] {
  const groups: DepartmentGroup<T>[] = DEPARTMENTS.map((department) => ({ department, items: [] as T[] }));
  const none: DepartmentGroup<T> = { department: null, items: [] };
  for (const item of items) {
    const group = groups.find((g) => g.department?.id === departmentOf(item));
    (group ?? none).items.push(item);
  }
  return [...groups, none].filter((g) => g.items.length > 0);
}
