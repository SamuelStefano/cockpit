import { useEffect, useState } from 'react';
import { Modal } from '../primitives';
import { subscribeArcade } from '../../game/arcade-bus';
import { useGameEnabled, useGameState } from '../../game/useGameState';
import { BitRunner } from './BitRunner';

// Bit Runner lives in a modal so there is no page for it; the popover and the
// palette both just ask for it over the arcade bus.
export function RunnerHost() {
  const enabled = useGameEnabled();
  const state = useGameState();
  const [open, setOpen] = useState(false);
  useEffect(() => subscribeArcade('runner', () => setOpen(true)), []);
  if (!enabled) return null;
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Bit Runner" icon="play" maxWidth="max-w-xl">
      <div className="p-3"><BitRunner best={state.highScore} /></div>
    </Modal>
  );
}
