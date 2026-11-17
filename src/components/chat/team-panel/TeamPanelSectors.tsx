import type { TeamPanel } from '../../../../shared/team-panel';
import { Badge } from '../../primitives/Badge';
import { PanelCard } from './PanelCard';
import { botDetail, needDetail, prDetail, prLine, type PanelDetail } from './panel-detail';

const TONE = { working: 'green', waiting: 'yellow', idle: 'neutral' } as const;
const Heading = ({ children }: { children: string }) => (
  <h4 className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-neutral-400">{children}</h4>
);

export function TeamPanelSectors({ panel, onOpen }: { panel: TeamPanel; onOpen: (d: PanelDetail) => void }) {
  return (
    <>
      <section aria-label="Needs you">
        <Heading>Needs you</Heading>
        <ul className="space-y-1.5">
          {panel.needsYou.map((n, i) => (
            <li key={i}><PanelCard title={n.text} meta={n.botName} onOpen={() => onOpen(needDetail(n))} /></li>
          ))}
          {!panel.needsYou.length && <li className="px-2 text-[12px] text-neutral-600">—</li>}
        </ul>
      </section>
      {panel.sectors.map((s) => (
        <section key={s.id} aria-label={s.name}>
          <Heading>{s.name}</Heading>
          <ul className="space-y-1.5">
            {s.bots.map((b) => (
              <li key={b.id}>
                <PanelCard title={b.name} meta={b.task} onOpen={() => onOpen(botDetail(b))}>
                  <span className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={TONE[b.status]} dot>{b.status}</Badge>
                    {b.openPrs.length > 0 && <Badge tone="orange">{b.openPrs.length} open</Badge>}
                    {b.mergedPrs.length > 0 && <Badge tone="green">{b.mergedPrs.length} merged</Badge>}
                    {b.needs.length > 0 && <Badge tone="red">{b.needs.length} blocked</Badge>}
                  </span>
                </PanelCard>
              </li>
            ))}
            {[...s.openPrs, ...s.mergedPrs].map((p) => (
              <li key={p.url}><PanelCard title={prLine(p)} meta={p.state} onOpen={() => onOpen(prDetail(p))} /></li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
