import './game.css';
import { Sheet, IconButton } from '../primitives';
import { useGameEnabled } from '../../game/useGameState';
import { useArcadeButton } from '../../game/useArcadeButton';
import { ArcadePanel } from './ArcadePanel';

// The whole Arcade is this one ~16px icon: it opens the popover (a bottom sheet on touch).
export function ArcadeButton({ expanded }: { expanded: boolean }) {
  const enabled = useGameEnabled();
  const { open, setOpen, flicker, state } = useArcadeButton();
  if (!enabled) return null;
  return (
    <Sheet
      open={open} onClose={() => setOpen(false)} label="Arcade"
      side={expanded ? 'top' : 'right'} align={expanded ? 'end' : 'end'}
      content={<ArcadePanel state={state} onClose={() => setOpen(false)} />}
    >
      <IconButton
        icon="zap" label="Arcade" side={expanded ? 'top' : 'right'} aria-haspopup="dialog" aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`text-neutral-500 hover:text-neutral-300 ${flicker ? 'arcade-flicker' : ''}`}
      />
    </Sheet>
  );
}
