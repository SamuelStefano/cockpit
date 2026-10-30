import './game.css';
import { IconButton } from '../primitives';
import { useGameEnabled } from '../../game/useGameState';
import { useArcadeButton } from '../../game/useArcadeButton';

// The only permanent trace of the Arcade in the chrome: one icon that opens its screen.
export function ArcadeButton({ expanded, onOpen }: { expanded: boolean; onOpen: () => void }) {
  const enabled = useGameEnabled();
  const { flicker } = useArcadeButton();
  if (!enabled) return null;
  return (
    <IconButton
      icon="zap" label="Arcade" side={expanded ? 'top' : 'right'}
      onClick={onOpen}
      className={`text-neutral-500 hover:text-neutral-300 ${flicker ? 'arcade-flicker' : ''}`}
    />
  );
}
