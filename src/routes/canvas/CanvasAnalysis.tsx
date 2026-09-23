import type { CanvasNode, TermStats } from '../../../shared/canvas';
import { relPast } from '../../../shared/format';
import { Button, Icon } from '../../components/primitives';
import { cpuHeat, ctxHeat, ctxPct, fmtMb, HEAT_TEXT, shortModel } from './term-stats-view';

interface Props {
  nodes: CanvasNode[];
  stats: Record<string, TermStats>;
  running: Set<string>;
  onPick: (id: string) => void;
  onClose: () => void;
}

// Every open terminal in one table, heaviest first: which session is eating the
// box, which one is about to run out of context, which one went quiet.
export function CanvasAnalysis({ nodes, stats, running, onPick, onClose }: Props) {
  const rows = nodes
    .map((n) => ({ n, s: stats[n.ref], live: n.kind === 'session' && running.has(n.ref) }))
    .sort((a, b) => (b.s?.cpu ?? 0) - (a.s?.cpu ?? 0) || (b.s?.rssMb ?? 0) - (a.s?.rssMb ?? 0));
  const cpu = rows.reduce((a, r) => a + (r.s?.cpu ?? 0), 0);
  const ram = rows.reduce((a, r) => a + (r.s?.rssMb ?? 0), 0);
  return (
    <aside data-canvas-overlay className="absolute left-3 top-3 z-20 flex max-h-[70%] w-[30rem] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl border border-neutral-700/80 bg-neutral-900/95 shadow-xl backdrop-blur-md">
      <header className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
        <Icon name="sliders" size={13} className="text-orange-400" />
        <span className="flex-1 text-[12.5px] font-semibold text-neutral-100">Análise dos terminais</span>
        <span className="font-mono text-[10.5px] text-neutral-500">{rows.length} · cpu {cpu}% · ram {fmtMb(ram)}</span>
        <Button variant="ghost" size="sm" square icon="x" title="fechar" onClick={onClose} />
      </header>
      <div className="grid grid-cols-[1fr_4.5rem_3rem_3.5rem_4rem] gap-x-2 border-b border-neutral-800 px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-neutral-600">
        <span>sessão</span><span>contexto</span><span>cpu</span><span>ram</span><span className="text-right">tempo</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {!rows.length && <p className="px-3 py-4 text-center text-[11.5px] text-neutral-500">nenhum terminal aberto — use “sessões” na barra de baixo</p>}
        {rows.map(({ n, s, live }) => {
          const pct = s ? ctxPct(s) : null;
          return (
            <button
              key={n.id} type="button" onClick={() => onPick(n.id)}
              className="grid w-full grid-cols-[1fr_4.5rem_3rem_3.5rem_4rem] items-center gap-x-2 px-3 py-1.5 text-left font-mono text-[11px] hover:bg-neutral-800/70"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${live ? 'animate-pulse bg-green-400' : n.kind === 'shell' ? 'bg-orange-400' : 'bg-neutral-600'}`} />
                <span className="truncate font-sans text-neutral-200">{n.title}</span>
                {s?.model && <span className="shrink-0 text-[9.5px] text-neutral-600">{shortModel(s.model)}</span>}
              </span>
              <span className={pct === null ? 'text-neutral-700' : HEAT_TEXT[ctxHeat(pct)]}>{pct === null ? '—' : `${pct}%`}</span>
              <span className={s ? HEAT_TEXT[cpuHeat(s.cpu)] : 'text-neutral-700'}>{s ? `${s.cpu}%` : '…'}</span>
              <span className="text-neutral-400">{s ? fmtMb(s.rssMb) : '…'}</span>
              <span className="text-right text-neutral-500">{live ? 'rodando' : s?.lastAt ? relPast(s.lastAt) : '—'}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
