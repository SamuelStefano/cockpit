import { useEffect, useRef, useState } from 'react';
import type { Mission } from '../missions';
import { loadMissionXp, saveMissionXp } from './missionXp';

const POWER_OFF_MS = 900;

export interface MissionRoomPanelProps {
  missions: Mission[];
  open: boolean;
  onClose: () => void;
  selectedId: string | null;
  onSelectMission: (id: string | null) => void;
  onComplete: (id: string) => boolean;
}

interface Ghost { mission: Mission; key: number }

export function MissionRoomPanel({ missions, open, onClose, selectedId, onSelectMission, onComplete }: MissionRoomPanelProps) {
  const [xp, setXp] = useState(loadMissionXp);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const seq = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => { for (const t of timers.current) window.clearTimeout(t); }, []);

  const selected = missions.find((m) => m.id === selectedId) ?? null;

  const complete = (m: Mission) => {
    if (!onComplete(m.id)) return;
    const next = xp + m.xp;
    setXp(next);
    saveMissionXp(next);
    const key = ++seq.current;
    setGhosts((g) => [...g, { mission: m, key }]);
    timers.current.push(window.setTimeout(() => setGhosts((g) => g.filter((x) => x.key !== key)), POWER_OFF_MS));
    onSelectMission(null);
  };

  if (!open) return null;
  return (
    <div className="base-missions base-plate" role="region" aria-label="Mission Room">
      <header>
        <b>Mission Room</b>
        <span className="xp" data-testid="mission-xp">{xp} XP</span>
        <span className="left">{missions.length} left</span>
        <button type="button" aria-label="Close Mission Room" onClick={onClose}>×</button>
      </header>
      {missions.length === 0 && ghosts.length === 0 && <p className="empty">All clear. No open tasks on the board.</p>}
      <div className="grid">
        {ghosts.map(({ mission: m, key }) => (
          <div key={`g${key}`} className="mission off" aria-hidden>
            <b>{m.title}</b>
            <span className="pop">+{m.xp} XP</span>
          </div>
        ))}
        {missions.map((m) => (
          <button
            type="button"
            key={m.id}
            className={`mission${m.suggested ? ' hot' : ''}${m.id === selectedId ? ' sel' : ''}`}
            onClick={() => onSelectMission(m.id)}
          >
            {m.suggested && <em className="start">START HERE</em>}
            <b>{m.title}</b>
            <span className="sum">{m.summary}</span>
            {m.suggested && <small className="why">{m.reason}</small>}
            <span className="meta">
              <i className={`size s-${m.size}`}>{m.size}</i>
              <i className="pts">{m.xp} XP</i>
              {m.status === 'doing' && <i className="doing">in progress</i>}
            </span>
          </button>
        ))}
      </div>
      {selected && (
        <div className="base-mission-detail base-plate" role="dialog" aria-modal="true" aria-label={selected.title}>
          <header>
            <b>{selected.title}</b>
            <i className={`size s-${selected.size}`}>{selected.size}</i>
            <i className="pts">{selected.xp} XP</i>
            <button type="button" aria-label="Close mission" onClick={() => onSelectMission(null)}>×</button>
          </header>
          {selected.suggested && <p className="why">{selected.reason}</p>}
          <pre>{selected.description || selected.summary}</pre>
          <footer>
            <button type="button" className="done" onClick={() => complete(selected)}>Complete mission</button>
          </footer>
        </div>
      )}
    </div>
  );
}
