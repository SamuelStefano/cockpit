import { Icon } from '../../components/primitives';
import type { ExploreItem } from './explore-items';

interface ExploreCardProps {
  item: ExploreItem;
  onOpen: (path: string) => void;
}

export function ExploreCard({ item, onOpen }: ExploreCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.path)}
      className="flex flex-col items-start gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800/60 focus-visible:outline-2 focus-visible:outline-orange-500"
    >
      <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/20 text-orange-300">
        <Icon name={item.icon} size={18} />
      </span>
      <h3 className="text-[15px] font-semibold text-neutral-100">{item.title}</h3>
      <span className="text-[13px] text-neutral-500">{item.description}</span>
    </button>
  );
}
