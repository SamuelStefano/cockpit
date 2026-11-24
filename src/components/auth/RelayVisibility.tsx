import { Icon } from '../primitives';
import { RELAY_SEES, RELAY_SOON } from './install-facts';

export function RelayVisibility() {
  return (
    <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 text-[12px] leading-relaxed text-neutral-400">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-200">
        <Icon name="alertTriangle" size={12} className="text-yellow-400" />
        O que o relay vê
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        {RELAY_SEES.map((t) => <li key={t}>{t}</li>)}
      </ul>
      <p className="mt-2 text-neutral-500">{RELAY_SOON}</p>
    </div>
  );
}
