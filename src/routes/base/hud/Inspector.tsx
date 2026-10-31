import { Button, Modal } from '../../../components/primitives';
import { STATE_LOOK } from '../engine/monitor';
import type { BaseEngine } from '../engine/engine';
import type { InspectView } from '../hudState';
import type { MonitorTab } from '../types';
import type { LiveActions } from '../useLiveFeed';
import { useInspector } from './useInspector';

const TABS: [MonitorTab, string][] = [['split', 'Live'], ['preview', 'Localhost'], ['diff', 'Diff'], ['terminal', 'Terminal'], ['trace', 'Trace']];

export function Inspector({ view, engine, live }: { view: InspectView; engine: BaseEngine; live: LiveActions }) {
  const c = useInspector(view, engine, live), st = STATE_LOOK[view.state] ?? STATE_LOOK.waiting, isLive = !!view.sessionId;
  return (
    <div className="base-inspect base-plate">
      <div className="who">
        <b>{view.name}</b>
        <span>{view.modelLabel}</span>
        <i style={{ color: st.css }}>{st.icon} {st.text}</i>
        <span>context {view.ctx === null ? 'unknown' : `${Math.round(view.ctx * 100)}%`}</span>
        {!isLive && (
          <span className="tabs">
            {TABS.map(([k, l]) => <button type="button" key={k} className={view.tab === k ? 'sel' : ''} onClick={() => engine.setTab(k)}>{l}</button>)}
          </span>
        )}
      </div>
      <div className="acts">
        {isLive ? (
          <>
            <Button size="sm" variant="primary" onClick={() => live.open(view.sessionId!)}>Open chat</Button>
            {view.running && <Button size="sm" variant="danger" onClick={() => c.setConfirmStop(true)}>Stop turn</Button>}
          </>
        ) : (
          <>
            <Button size="sm" variant="secondary" onClick={() => engine.togglePaused()}>{view.paused ? 'Resume' : 'Interrupt'}</Button>
            <Button size="sm" variant="secondary" onClick={() => engine.toggleSupervised()}>{view.supervised ? 'Supervised' : 'Full access'}</Button>
          </>
        )}
        <Button size="sm" variant="secondary" onClick={() => engine.pin(view.id)}>Pin</Button>
        <input value={c.text} onChange={(e) => c.setText(e.target.value)} placeholder={isLive ? 'Send a real message to this session, press Enter' : `Tell ${view.name} something, press Enter`}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') c.send(); if (e.key === 'Escape') engine.back(); }} />
        <Button size="sm" variant="ghost" onClick={() => engine.back()}>Back · Esc</Button>
      </div>
      <Modal open={c.confirmStop} onClose={() => c.setConfirmStop(false)} title="Stop this turn?"
        footer={<><Button variant="secondary" onClick={() => c.setConfirmStop(false)}>Keep running</Button><Button variant="dangerSolid" onClick={c.stop}>Stop turn</Button></>}>
        <p className="text-sm text-neutral-300">{view.name}</p>
      </Modal>
    </div>
  );
}
