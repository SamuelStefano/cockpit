import { useState } from 'react';
import { Badge } from '../Badge';
import type { DeckPanelData, PanelItem } from './parse-panel';
import { PanelColumnView } from './PanelColumnView';
import { PanelItemModal } from './PanelItemModal';

export function DeckPanel({ data }: { data: DeckPanelData }) {
  const [open, setOpen] = useState<PanelItem | null>(null);
  return (
    <section aria-label={data.title} className="not-prose rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 text-[14px] leading-5">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-neutral-100">{data.title}</h3>
        {data.subtitle && <span className="text-neutral-500">{data.subtitle}</span>}
        <div className="ml-auto flex flex-wrap gap-1.5">
          {data.columns.map((c) => (
            <Badge key={c.label} tone={c.tone} dot>{c.items.length} {c.label}</Badge>
          ))}
        </div>
      </header>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))` }}>
        {data.columns.map((c) => <PanelColumnView key={c.label} column={c} onOpen={setOpen} />)}
      </div>
      <PanelItemModal item={open} onClose={() => setOpen(null)} />
    </section>
  );
}
