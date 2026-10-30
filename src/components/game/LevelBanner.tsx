import './game.css';
import { Bit } from '../bit/Bit';
import type { RewardView } from '../../game/reward-view';

export function LevelBanner({ item, onDismiss }: { item: RewardView; onDismiss: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="arcade-banner arcade-pixel fixed inset-x-0 top-0 z-65"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <button
        type="button"
        onClick={onDismiss}
        className="flex w-full items-center justify-center gap-4 border-b border-orange-400/50 bg-linear-to-r from-orange-700/95 via-orange-500/95 to-orange-700/95 px-4 py-2 text-left"
      >
        <Bit state="wave" size={44} title="Bit comemorando" />
        <span className="min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-orange-100/80">Subiu de nível</span>
          <span className="block truncate text-[18px] font-bold text-white">Nível {item.level} · {item.sub}</span>
        </span>
      </button>
    </div>
  );
}
