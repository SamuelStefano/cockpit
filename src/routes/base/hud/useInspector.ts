import { useState } from 'react';
import type { BaseEngine } from '../engine/engine';
import type { InspectView } from '../hudState';
import type { LiveActions } from '../useLiveFeed';

export function useInspector(view: InspectView, engine: BaseEngine, live: LiveActions) {
  const [text, setText] = useState('');
  const [confirmStop, setConfirmStop] = useState(false);
  const send = () => {
    const clean = text.trim();
    if (!clean) return;
    if (view.sessionId) { if (live.send(view.sessionId, clean)) { setText(''); engine.toast('Sent'); } return; }
    engine.tellPractice(clean);
    setText('');
  };
  const stop = () => { if (view.sessionId) live.stop(view.sessionId); setConfirmStop(false); };
  return { text, setText, send, confirmStop, setConfirmStop, stop };
}
