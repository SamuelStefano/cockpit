import type { BudgetStatus } from '../../../shared/canvas-budget';
import type { AreaId } from '../../../shared/canvas';
import { Icon } from '../../components/primitives';
import type { AreaRect } from './canvas-areas';

// Low-alpha fills tuned for the dark orange-accent Deck palette: 'deck' itself
// gets the app's own accent (it IS the Deck), the rest spread across the wheel
// so no two of the 6 areas read as the same color at a glance.
const STYLE: Record<AreaId, { box: string; chip: string }> = {
  dfl: { box: 'border-sky-500/25 bg-sky-500/[0.06]', chip: 'border-sky-500/40 bg-sky-500/10 text-sky-300' },
  itera: { box: 'border-violet-500/25 bg-violet-500/[0.06]', chip: 'border-violet-500/40 bg-violet-500/10 text-violet-300' },
  deck: { box: 'border-orange-500/25 bg-orange-500/[0.06]', chip: 'border-orange-500/40 bg-orange-500/10 text-orange-300' },
  pessoal: { box: 'border-emerald-500/25 bg-emerald-500/[0.06]', chip: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  infra: { box: 'border-cyan-500/25 bg-cyan-500/[0.06]', chip: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' },
  outros: { box: 'border-neutral-500/25 bg-neutral-500/[0.06]', chip: 'border-neutral-600/50 bg-neutral-800/60 text-neutral-400' },
};

interface Props {
  rects: AreaRect[];
  status: Partial<Record<AreaId, BudgetStatus>>;
  onEditBudget: (area: AreaId) => void;
  // Timeline scrubbed away from live: a region's budget/running count is a
  // LIVE reading, meaningless looking at the past — dims along with the rest.
  past: boolean;
}

// Same factor CanvasEdges.tsx/CanvasFlowArrows.tsx use for "dim, looking at
// the past" — one shared strength across every layer of the canvas.
const PAST_DIM = 0.35;

// Behind every node card (rendered first inside the pan/zoom layer): a soft
// rounded region with a title chip. The box itself never eats a pointer event
// (drag/pan must reach the node or the background under it); only the chip's
// click surface does, and it stops the down event so it can't also start a pan.
export function CanvasAreas({ rects, status, onEditBudget, past }: Props) {
  return (
    <>
      {rects.map((r) => {
        const st = status[r.area];
        const over = !!st && (st.overCpu || st.overCtx);
        const style = STYLE[r.area];
        const counts = [`${r.sessions} sessões`, r.running ? `${r.running} rodando` : null, r.terminals ? `${r.terminals} abertos` : null]
          .filter(Boolean).join(' · ');
        return (
          <div
            key={r.area} className="pointer-events-none absolute left-0 top-0"
            style={{ transform: `translate(${r.x}px, ${r.y}px)`, width: r.w, height: r.h, opacity: past ? PAST_DIM : 1 }}
          >
            {/* Fill never pulses — a map-sized translucent rect flashing opacity
                reads as the whole region blinking, not as an alert. Only the
                border (thin, no fill of its own) does, and only the chip turns
                solid red; see the sibling button below. */}
            <div className={`absolute inset-0 rounded-[28px] border ${over ? 'border-red-500/50' : style.box}`} />
            {over && (
              <div className="pointer-events-none absolute inset-0 rounded-[28px] border-2 border-red-500/70 motion-safe:animate-pulse" />
            )}
            <button
              type="button"
              data-canvas-overlay
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onEditBudget(r.area)}
              title={over ? `Orçamento estourado: ${st!.reasons.join(' · ')}` : `Orçamento da área ${r.label}`}
              className={`pointer-events-auto absolute left-3 top-3 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm transition-colors
                ${over ? 'border-red-500/60 bg-red-500/15 text-red-300' : style.chip}`}
            >
              <Icon name="layers" size={11} />
              <span>{r.label}</span>
              {counts && <span className="opacity-70">{counts}</span>}
              <Icon name="sliders" size={11} className="opacity-60" />
            </button>
          </div>
        );
      })}
    </>
  );
}
