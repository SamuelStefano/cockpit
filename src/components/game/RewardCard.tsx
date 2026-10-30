import './game.css';
import type { RewardView } from '../../game/reward-view';

// Xbox-style achievement slide-in: pixel-ish monospace, bottom-center, never steals focus.
export function RewardCard({ item, onDismiss }: { item: RewardView; onDismiss: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="arcade-slide-up arcade-pixel pointer-events-none fixed left-1/2 z-65 w-[min(92vw,360px)] -translate-x-1/2"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
    >
      <button
        type="button"
        onClick={onDismiss}
        className="pointer-events-auto flex w-full items-center gap-3 rounded-full border border-orange-500/40 bg-neutral-950/95 py-2 pl-2 pr-5 text-left shadow-lg shadow-black/50"
      >
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-[20px]">{item.icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-bold text-orange-300">{item.title}</span>
          <span className="block truncate text-[11px] text-neutral-400">{item.sub}</span>
        </span>
      </button>
    </div>
  );
}
