import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeRewards } from './game-bus';
import { rewardViews, turnXp, type RewardView } from './reward-view';
import { sfx } from './sfx';
import { fireConfetti } from '../components/primitives/confetti-bus';

const SHOW_MS: Record<RewardView['kind'], number> = { achievement: 4800, level: 5200, quest: 3200, streak: 3000 };
const MAX_QUEUE = 6;
const FLOAT_MS = 1500;

export interface XpFloatItem { id: number; amount: number }

// One card or banner at a time: bursts (a turn that unlocks a quest, an achievement
// and a level) wait in line instead of stacking on screen.
export function useRewardQueue() {
  const [current, setCurrent] = useState<RewardView | null>(null);
  const [floats, setFloats] = useState<XpFloatItem[]>([]);
  const queue = useRef<RewardView[]>([]);
  const showing = useRef(false);
  const timer = useRef(0);
  const floatSeq = useRef(0);

  const next = useCallback(() => {
    const item = queue.current.shift();
    if (!item) { showing.current = false; setCurrent(null); return; }
    showing.current = true;
    setCurrent(item);
    if (item.kind === 'level') { sfx.levelUp(); fireConfetti({ count: 70 }); }
    else if (item.kind === 'achievement') sfx.achievement();
    else sfx.coin();
    timer.current = window.setTimeout(next, SHOW_MS[item.kind]);
  }, []);

  const dismiss = useCallback(() => { window.clearTimeout(timer.current); next(); }, [next]);

  useEffect(() => {
    const floatTimers = new Set<number>();
    const off = subscribeRewards((rewards) => {
      const xp = turnXp(rewards);
      if (xp > 0) {
        const id = ++floatSeq.current;
        setFloats((f) => [...f, { id, amount: xp }].slice(-3));
        const t = window.setTimeout(() => { floatTimers.delete(t); setFloats((f) => f.filter((x) => x.id !== id)); }, FLOAT_MS);
        floatTimers.add(t);
      }
      const views = rewardViews(rewards);
      if (!views.length) return;
      queue.current = [...queue.current, ...views].slice(-MAX_QUEUE);
      if (!showing.current) next();
    });
    return () => { off(); window.clearTimeout(timer.current); for (const t of floatTimers) clearTimeout(t); };
  }, [next]);

  return { current, floats, dismiss };
}
