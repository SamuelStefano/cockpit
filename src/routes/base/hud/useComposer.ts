import { useState } from 'react';
import type { BaseEngine } from '../engine/engine';
import type { HudState } from '../hudState';

export function useComposer(hud: HudState, engine: BaseEngine) {
  const [text, setText] = useState('');
  const [wing, setWing] = useState(hud.wings[0]?.id ?? '');
  const [width, setWidth] = useState(3);
  const send = () => {
    const t = text.trim();
    if (!t || !wing) return;
    engine.sendPrompt(t, wing, width);
    setText('');
  };
  return { text, setText, wing, setWing, width, setWidth, send };
}
