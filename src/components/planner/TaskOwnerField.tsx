import type { TeamBot } from '../../../shared/protocol';
import { groupByDepartment } from '../../../shared/departments';
import { tokens } from '../primitives';

interface Props { bots: TeamBot[]; value: string | undefined; onChange: (botId: string | undefined) => void }

export function TaskOwnerField({ bots, value, onChange }: Props) {
  const groups = groupByDepartment(bots, (b) => b.department);
  const known = !value || bots.some((b) => b.id === value);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] text-neutral-500">Dono</span>
      <select
        value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} aria-label="Dono"
        className={`rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px] text-neutral-200 ${tokens.focusRing}`}
      >
        <option value="">Sem dono</option>
        {!known && <option value={value}>{value}</option>}
        {groups.map((g) => (
          <optgroup key={g.department?.id ?? 'none'} label={g.department?.name ?? 'Sem setor'}>
            {g.items.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
