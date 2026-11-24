import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeRewards } from './game-bus';
import { subscribePills, type PillInput } from './pill-bus';
import { rewardViews } from './reward-view';
import { sfx } from './sfx';
import { fireConfetti } from '../components/primitives/confetti-bus';

export const PILL_MS = 3000;
export const LEVEL_CONFETTI = 24;
const MAX_QUEUE = 4;

export interface PillView extends PillInput { id: number; sound?: 'level' | 'achievement' | 'coin' }

// One pill at a time; bursts wait in line. Each pill leaves by itself after 3 s.
export function useRewardQueue() {
  const [current, setCurrent] = useState<PillView | null>(null);
  const queue = useRef<PillView[]>([]);
  const showing = useRef(false);
  const timer = useRef(0);
  const seq = useRef(0);

  const next = useCallback(() => {
    const item = queue.current.shift();
    if (!item) { showing.current = false; setCurrent(null); return; }
    showing.current = true;
    setCurrent(item);
    if (item.sound === 'level') sfx.levelUp();
    else if (item.sound === 'achievement') sfx.achievement();
    else sfx.coin();
    if (item.confetti) fireConfetti({ count: item.confetti });
    timer.current = window.setTimeout(next, PILL_MS);
  }, []);

  const push = useCallback((views: PillView[]) => {
    if (!views.length) return;
    queue.current = [...queue.current, ...views].slice(-MAX_QUEUE);
    if (!showing.current) next();
  }, [next]);

  const dismiss = useCallback(() => { window.clearTimeout(timer.current); next(); }, [next]);

  useEffect(() => {
    const offRewards = subscribeRewards((rewards) => {
      push(rewardViews(rewards).map((v) => ({
        id: v.id,
        icon: v.icon,
        title: v.kind === 'level' ? `Nível ${v.level}` : v.title,
        confetti: v.kind === 'level' ? LEVEL_CONFETTI : undefined,
        sound: v.kind === 'level' ? 'level' : v.kind === 'achievement' ? 'achievement' : 'coin',
      })));
    });
    const offPills = subscribePills((p) => push([{ ...p, id: -(++seq.current), sound: 'coin' }]));
    return () => { offRewards(); offPills(); window.clearTimeout(timer.current); };
  }, [push]);

  return { current, dismiss };
}
