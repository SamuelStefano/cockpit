import { useState } from 'react';
import './game.css';
import { Tooltip } from '../primitives';
import { ACHIEVEMENTS } from '../../game/achievements';
import type { GameState } from '../../game/types';

// Tiny glyphs, no cards. Hover shows the name; a tap (no hover on touch) writes it
// on the caption line below. Locked secrets never reveal their name.
export function ArcadeAchievements({ state }: { state: GameState }) {
  const [hint, setHint] = useState('');
  return (
    <div>
      <ul className="flex flex-wrap gap-1">
        {ACHIEVEMENTS.map((a) => {
          const on = !!state.unlocked[a.id];
          const secret = !on && a.hidden;
          const name = secret ? '???' : a.title;
          return (
            <li key={a.id}>
              <Tooltip label={name} side="top" delay={120}>
                <button
                  type="button"
                  aria-label={on ? name : `${name} (bloqueada)`}
                  onClick={() => setHint(on ? `${a.icon} ${a.title}: ${a.desc}` : secret ? '???' : `${a.title}: ${a.desc}`)}
                  className={`flex h-[18px] w-[18px] items-center justify-center rounded-xs text-[13px] leading-none focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-orange-500/50 ${on ? '' : 'arcade-locked'}`}
                >
                  <span aria-hidden>{secret ? '·' : a.icon}</span>
                </button>
              </Tooltip>
            </li>
          );
        })}
      </ul>
      {hint && <p role="status" className="mt-1.5 text-[11px] leading-snug text-neutral-500">{hint}</p>}
    </div>
  );
}
