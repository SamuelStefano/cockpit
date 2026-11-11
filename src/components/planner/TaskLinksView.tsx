import type { PlannerLink } from '../../../shared/planner';
import { Icon } from '../primitives';

export function TaskLinksView({ links }: { links: PlannerLink[] }) {
  if (!links.length) return null;
  return (
    <ul className="flex flex-col gap-1">
      {links.map((l) => (
        <li key={l.url}>
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-[13px] text-orange-400 hover:underline">
            <Icon name="external" size={12} className="shrink-0" /><span className="truncate">{l.label || l.url}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
