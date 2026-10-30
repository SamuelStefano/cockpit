import { useGameEnabled } from '../../game/useGameState';
import { useRewardQueue } from '../../game/useRewardQueue';
import { RewardCard } from './RewardCard';
import { LevelBanner } from './LevelBanner';
import { XpFloat } from './XpFloat';

function Layer() {
  const { current, floats, dismiss } = useRewardQueue();
  return (
    <>
      <XpFloat items={floats} />
      {current && (current.kind === 'level'
        ? <LevelBanner key={current.id} item={current} onDismiss={dismiss} />
        : <RewardCard key={current.id} item={current} onDismiss={dismiss} />)}
    </>
  );
}

export function RewardHost() {
  const enabled = useGameEnabled();
  return enabled ? <Layer /> : null;
}
