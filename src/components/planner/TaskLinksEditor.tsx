import type { PlannerLink } from '../../../shared/planner';
import { PLANNER_LIMITS } from '../../../shared/planner';
import { Button, Input } from '../primitives';

import { isHttpUrl } from '../../planner/useTaskEditor';

interface Props { links: PlannerLink[]; onChange: (links: PlannerLink[]) => void }

export function TaskLinksEditor({ links, onChange }: Props) {
  const set = (i: number, patch: Partial<PlannerLink>) => onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div className="flex flex-col gap-2">
      {links.map((l, i) => (
        <div key={i} className="flex items-center gap-2 max-sm:flex-wrap">
          <Input
            size="sm" value={l.url} placeholder="https://…" aria-label="URL" error={l.url !== '' && !isHttpUrl(l.url)}
            className="min-w-0 flex-2" onChange={(e) => set(i, { url: e.target.value })}
          />
          <Input size="sm" value={l.label ?? ''} placeholder="Rótulo" aria-label="Rótulo" maxLength={PLANNER_LIMITS.linkLabel} className="min-w-0 flex-1" onChange={(e) => set(i, { label: e.target.value })} />
          <Button variant="ghost" size="sm" square icon="x" aria-label="Remover link" onClick={() => onChange(links.filter((_, j) => j !== i))} />
        </div>
      ))}
      {links.length < PLANNER_LIMITS.links && (
        <Button variant="ghost" size="xs" icon="plus" className="self-start" onClick={() => onChange([...links, { url: '' }])}>Adicionar link</Button>
      )}
    </div>
  );
}
