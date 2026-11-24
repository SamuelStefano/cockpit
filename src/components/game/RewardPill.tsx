import './game.css';
import type { PillView } from '../../game/useRewardQueue';

// A one-line pill, icon and name only: never steals focus, clears itself.
export function RewardPill({ item, onDismiss }: { item: PillView; onDismiss: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="arcade-pill-in pointer-events-none fixed left-1/2 z-65 [--arcade-x:-50%] md:left-auto md:right-5 md:[--arcade-x:0%]"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}
    >
      <button
        type="button"
        onClick={onDismiss}
        className="pointer-events-auto flex h-6 max-w-[min(92vw,320px)] items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-950/95 pl-1.5 pr-2.5 text-[12px] leading-none text-neutral-200 shadow-md shadow-black/40"
      >
        <span aria-hidden className="text-[13px]">{item.icon}</span>
        <span className="truncate">{item.title}</span>
      </button>
    </div>
  );
}
