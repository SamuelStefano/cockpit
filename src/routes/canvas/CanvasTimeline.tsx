import { Badge, Button, Icon } from '../../components/primitives';
import { fmtTimelineStamp } from './canvas-timeline';
import type { Timeline } from './useTimeline';

interface Props {
  timeline: Timeline;
}

// Compact 7-day scrub bar, sat above the kanban dock. Dragging it away from
// "agora" freezes the canvas at that instant (CanvasSurface dims whatever
// wasn't alive then); play animates forward; "agora" snaps back to live.
export function CanvasTimeline({ timeline: tl }: Props) {
  const pct = ((tl.t - tl.rangeStart) / (tl.rangeEnd - tl.rangeStart)) * 100;
  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-neutral-800/80 bg-neutral-950 px-3 py-1.5">
      <Button
        variant="ghost" size="sm" square icon={tl.playing ? 'pause' : 'play'}
        title={tl.playing ? 'pausar' : 'reproduzir a partir daqui'}
        onClick={() => (tl.playing ? tl.pause() : tl.play())}
      />
      <span className="font-mono text-[10.5px] text-neutral-500">7d atrás</span>
      <input
        type="range" min={tl.rangeStart} max={tl.rangeEnd} value={tl.t} step={60_000}
        onChange={(e) => tl.setT(Number(e.target.value))}
        className="h-1.5 w-full max-w-md flex-1 cursor-pointer accent-orange-500"
        aria-label="linha do tempo do canvas"
        style={{ background: `linear-gradient(to right, rgb(249 115 22) ${pct}%, rgb(38 38 38) ${pct}%)` }}
      />
      <span className="font-mono text-[10.5px] text-neutral-500">agora</span>
      <Badge tone={tl.live ? 'green' : 'orange'} dot>
        <Icon name="clock" size={10} />
        {tl.live ? 'ao vivo' : fmtTimelineStamp(tl.t)}
      </Badge>
      {!tl.live && <Button variant="secondary" size="sm" onClick={tl.goLive}>agora</Button>}
    </div>
  );
}
