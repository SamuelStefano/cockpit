import { PULSE_LABEL, SALA_H, SALA_W, type SalaEdge, type SalaNode } from './sala/model';

interface Props {
  nodes: SalaNode[];
  edges: SalaEdge[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function SalaMap({ nodes, edges, selectedId, onSelect }: Props) {
  const at = new Map(nodes.map((n) => [n.id, n]));
  return (
    <div className="relative mx-auto aspect-[1000/640] w-full max-w-5xl">
      <svg viewBox={`0 0 ${SALA_W} ${SALA_H}`} className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="sala-glow" cx="50%" cy="48%" r="55%">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.16" />
            <stop offset="70%" stopColor="#0a0a0a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={SALA_W} height={SALA_H} fill="url(#sala-glow)" />
        <circle cx="500" cy="300" r="198" fill="none" stroke="#404040" strokeDasharray="3 8" />
        <circle cx="500" cy="300" r="292" fill="none" stroke="#262626" strokeDasharray="2 10" />
        {edges.map((e) => {
          const a = at.get(e.from);
          const b = at.get(e.to);
          if (!a || !b) return null;
          return (
            <line
              key={`${e.from}-${e.to}`}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={e.live ? '#fb923c' : '#525252'}
              strokeWidth={e.live ? 2.4 : 1.2}
            />
          );
        })}
      </svg>
      {nodes.map((n) => {
        const on = n.id === selectedId;
        return (
          <button
            key={n.id}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(n.id)}
            className="absolute flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{ left: `${(n.x / SALA_W) * 100}%`, top: `${(n.y / SALA_H) * 100}%` }}
          >
            <span
              className={`grid h-11 w-11 place-items-center rounded-full border-2 text-[11px] font-semibold text-neutral-950 ${n.pulse === 'working' ? 'motion-safe:animate-pulse' : ''}`}
              style={{ background: n.color, borderColor: on ? '#fff' : n.color, boxShadow: on ? `0 0 0 4px ${n.color}55` : undefined }}
            >
              {n.title.slice(0, 2).toUpperCase()}
            </span>
            <span className="max-w-full truncate text-[12px] font-medium text-neutral-100">{n.title}</span>
            <span className="text-[10px] uppercase tracking-wide text-neutral-500">{PULSE_LABEL[n.pulse]}</span>
          </button>
        );
      })}
    </div>
  );
}
