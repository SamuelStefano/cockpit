import { ProgressBar } from '../../components/primitives';
import { brlShort } from './money';

interface Props {
  valueCents: number;
  capCents: number;
  over: boolean;
  label?: string;
}

// The R$ 5k per-epic cap as a meter with its number: how full, and by how much it
// passes. Yellow past the cap — the cue to split the epic.
export function CapMeter({ valueCents, capCents, over, label = 'do teto' }: Props) {
  const pct = Math.round((valueCents / capCents) * 100);
  const fill = Math.min(valueCents, capCents);
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] tabular-nums" title={`teto por épico: ${brlShort(capCents)}`}>
      <span className="block w-24">
        <ProgressBar size="xs" segments={[
          { value: fill, tone: over ? 'yellow' : 'orange' },
          { value: Math.max(0, capCents - fill), tone: 'track' },
        ]} />
      </span>
      <span className={over ? 'text-yellow-300' : 'text-neutral-500'}>{pct}% {label}</span>
    </span>
  );
}
