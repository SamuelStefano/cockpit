import type { PrSummary } from '../../../shared/prs';
import { PrRow } from './PrRow';
import type { DayGroup } from './prs-view';

interface PrListProps {
  tab: 'mine' | 'review' | 'merged';
  prs: PrSummary[];
  days: DayGroup[];
  selectedUrl: string | null;
  onSelect: (url: string) => void;
}

export function PrList({ tab, prs, days, selectedUrl, onSelect }: PrListProps) {
  if (tab === 'merged') {
    return (
      <div className="space-y-4">
        {days.map((d) => (
          <section key={d.key}>
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-500">{d.label}</h3>
            <div className="space-y-2">
              {d.prs.map((p) => <PrRow key={p.url} pr={p} active={p.url === selectedUrl} onSelect={onSelect} />)}
            </div>
          </section>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {prs.map((p) => <PrRow key={p.url} pr={p} active={p.url === selectedUrl} onSelect={onSelect} />)}
    </div>
  );
}
