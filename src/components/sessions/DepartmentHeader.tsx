import type { Department } from '../../../shared/departments';

export function DepartmentHeader({ department, count }: { department: Department | null; count: number }) {
  return (
    <div className="flex items-center gap-1.5 px-1.5 pb-0.5 pt-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: department?.color ?? '#525252' }} />
      <span className="truncate">{department?.name ?? 'Sem setor'}</span>
      <span className="font-normal text-neutral-600">{count}</span>
    </div>
  );
}
