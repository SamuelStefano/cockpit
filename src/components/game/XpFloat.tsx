import './game.css';
import type { XpFloatItem } from '../../game/useRewardQueue';

// Low-key: tiny monospace text in the corner that drifts up and fades.
export function XpFloat({ items }: { items: XpFloatItem[] }) {
  if (!items.length) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed right-5 z-60 flex flex-col items-end gap-1" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>
      {items.map((f) => (
        <span key={f.id} className="arcade-float arcade-pixel text-[12px] font-bold text-orange-300/90">+{f.amount} XP</span>
      ))}
    </div>
  );
}
