import { Badge, Checkbox } from '../primitives';
import { PROVIDER_STATUS_LABEL, PROVIDER_STATUS_TONE, type ProviderCardModel } from '../../cockpit/provider-onboarding';

interface ProviderCardProps {
  card: ProviderCardModel;
  selected: boolean;
  onToggle: () => void;
}

export function ProviderCard({ card, selected, onToggle }: ProviderCardProps) {
  return (
    <div
      onClick={onToggle}
      className={`flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3 transition ${selected ? 'border-orange-500/60 bg-orange-500/5' : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'}`}
    >
      <div className="flex items-center gap-2">
        <Checkbox checked={selected} onChange={onToggle} label={`Configurar ${card.label}`} />
        <span className="text-[13.5px] font-semibold text-neutral-100">{card.label}</span>
        <Badge tone={PROVIDER_STATUS_TONE[card.status]} dot className="ml-auto">{PROVIDER_STATUS_LABEL[card.status]}</Badge>
      </div>
      <p className="text-[12px] leading-relaxed text-neutral-400">{card.blurb}</p>
    </div>
  );
}
