import type { Decision } from '../types';

const QWE = ['Q', 'W', 'E'];

interface Props { alert: Decision; first: boolean; hotkeys: boolean; secondsLeft: number | null; onFocus: () => void; onChoose: (i: number) => void }

export function AlertCard({ alert: a, first, hotkeys, secondsLeft, onFocus, onChoose }: Props) {
  return (
    <div className={`base-alert${a.risk ? ` r-${a.risk}` : ''}`} onClick={onFocus}>
      {(first || a.risk || secondsLeft !== null) && (
        <div className="top">
          {first && <i>NOW</i>}
          {a.risk && <i className="risk">{a.risk}</i>}
          {secondsLeft !== null && <em>{secondsLeft}s left</em>}
        </div>
      )}
      <b>{a.title}</b>
      <span>{a.what}</span>
      <small>{a.why}</small>
      <div className="opts">
        {a.opts.map((o, i) => (
          <button type="button" key={`${o.label}-${i}`} title={o.hint} className={o.rec ? 'rec' : ''} onClick={(e) => { e.stopPropagation(); onChoose(i); }}>
            {first && hotkeys && QWE[i] && <kbd>{QWE[i]}</kbd>} {o.label}
            {o.hint && <u>{o.hint}</u>}
          </button>
        ))}
      </div>
    </div>
  );
}
