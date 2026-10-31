import { useGameEnabled } from '../../game/useGameState';
import { useRewardQueue } from '../../game/useRewardQueue';
import { RewardPill } from './RewardPill';

function Layer() {
  const { current, dismiss } = useRewardQueue();
  return current ? <RewardPill key={current.id} item={current} onDismiss={dismiss} /> : null;
}

export function RewardHost() {
  const enabled = useGameEnabled();
  return enabled ? <Layer /> : null;
}
