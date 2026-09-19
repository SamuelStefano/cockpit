import { Icon } from '../../components/primitives';
import type { SessionUsage } from '../../../shared/protocol';
import { fmtNum as fmt } from '../observatorio-format';
import { fmtCost, relPast } from '../../../shared/format';
import { ctxPctOf } from '../../../shared/context-window';



interface UsageRowProps {
  row: SessionUsage;
  maxOut: number;
  title: string;
  openable: boolean;
  onOpen: () => void;
}

export function UsageRow({ row, maxOut, title, openable, onOpen }: UsageRowProps) {
  // Janela pelo modelo PEDIDO: só ele carrega a marca `[1m]` (o id efetivo da
  // API nunca carrega), e sem isso uma sessão de 1M aparecia 100% vermelha.
  const fill = ctxPctOf(row.ctxTokens, row.requestedModel);
  return (
    <tr
      onClick={openable ? onOpen : undefined}
      tabIndex={openable ? 0 : undefined}
      onKeyDown={openable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } } : undefined}
      title={openable ? 'Abrir sessão no chat' : undefined}
      className={`border-b border-neutral-800/60 last:border-0 hover:bg-neutral-900/40 ${openable ? 'cursor-pointer' : ''}`}
    >
      <td className="max-w-0 px-2 py-2 sm:px-3">
        <div className="truncate text-neutral-300">{title}</div>
        {row.model && <div className="truncate font-mono text-[10px] text-neutral-600">{row.model}</div>}
      </td>
      <td className="hidden px-3 py-2 md:table-cell">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-800">
            <div className={`h-full rounded-full ${fill > 75 ? 'bg-red-500' : fill > 50 ? 'bg-amber-500' : 'bg-orange-500'}`} style={{ width: `${fill}%` }} />
          </div>
          <span className="font-mono text-[11px] text-neutral-500">{fmt(row.ctxTokens)}</span>
          {fill >= 75 && (
            <span title="Contexto quase cheio — considere uma nova sessão" className="flex items-center gap-0.5 rounded-sm bg-red-500/10 px-1 text-[9.5px] font-medium text-red-400">
              <Icon name="zap" size={9} /> {fill}%
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-2 sm:px-3">
        <div className="flex items-center gap-2">
          <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-neutral-800 sm:block">
            <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.round((row.outputTokens / maxOut) * 100)}%` }} />
          </div>
          <span className="font-mono text-[11px] text-neutral-400">{fmt(row.outputTokens)}</span>
        </div>
      </td>
      <td className="px-2 py-2 font-mono text-[11px] text-emerald-400/80 sm:px-3">{fmtCost(row.costUsd)}</td>
      <td className="hidden px-3 py-2 font-mono text-neutral-500 lg:table-cell">{row.samples}</td>
      <td className="whitespace-nowrap px-2 py-2 text-right text-neutral-500 sm:px-3">{relPast(row.lastTs)}</td>
    </tr>
  );
}
