import type { RedactedTeamPanel } from '../../../../shared/team-panel';
import { Badge } from '../../primitives/Badge';
import { PanelCard } from './PanelCard';

const TONE = { working: 'green', waiting: 'yellow', idle: 'neutral' } as const;

export function TeamPanelRedacted({ panel }: { panel: RedactedTeamPanel }) {
  return (
    <>
      <Badge tone={panel.needsYou ? 'red' : 'neutral'}>{panel.needsYou} need you</Badge>
      {panel.sectors.map((s) => (
        <section key={s.name} aria-label={s.name}>
          <h4 className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-neutral-400">{s.name}</h4>
          <ul className="space-y-1.5">
            {s.bots.map((b) => (
              <li key={b.name}>
                <PanelCard title={b.name}>
                  <span className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={TONE[b.status]} dot>{b.status}</Badge>
                    <Badge>{b.openPrs} open</Badge>
                    <Badge>{b.mergedPrs} merged</Badge>
                    <Badge>{b.blockers} blocked</Badge>
                  </span>
                </PanelCard>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
