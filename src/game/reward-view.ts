import type { Reward } from './types';
import { achievementById } from './achievements';
import { questById, QUEST_BONUS_XP } from './quests';

export interface RewardView {
  id: number;
  kind: 'achievement' | 'quest' | 'streak' | 'level';
  icon: string;
  title: string;
  sub: string;
  level?: number;
}

let seq = 0;

// XP rewards are not cards (they float separately); everything else becomes one
// card, queued so only one shows at a time.
export function rewardViews(rewards: Reward[]): RewardView[] {
  const out: RewardView[] = [];
  for (const r of rewards) {
    if (r.kind === 'achievement') {
      const a = achievementById(r.id);
      if (a) out.push({ id: ++seq, kind: 'achievement', icon: a.icon, title: a.title, sub: `Conquista desbloqueada · ${a.desc}` });
    } else if (r.kind === 'quest') {
      if (r.bonus) out.push({ id: ++seq, kind: 'quest', icon: '🎁', title: 'Missões do dia completas', sub: `Bônus de +${QUEST_BONUS_XP} XP` });
      else {
        const q = questById(r.id);
        if (q) out.push({ id: ++seq, kind: 'quest', icon: '✅', title: 'Missão cumprida', sub: `${q.title} · +${q.xp} XP` });
      }
    } else if (r.kind === 'streak') {
      out.push({ id: ++seq, kind: 'streak', icon: '🔥', title: `${r.days} dias seguidos`, sub: 'Sequência mantida' });
    } else if (r.kind === 'level') {
      out.push({ id: ++seq, kind: 'level', icon: '⬆️', title: `Nível ${r.level}`, sub: r.title, level: r.level });
    }
  }
  return out;
}

export const turnXp = (rewards: Reward[]): number =>
  rewards.reduce((n, r) => (r.kind === 'xp' && r.source === 'turn_done' ? n + r.amount : n), 0);
