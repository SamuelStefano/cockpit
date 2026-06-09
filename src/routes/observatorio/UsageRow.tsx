import { Icon } from '../../components/primitives';
import type { SessionUsage } from '../../../shared/protocol';
import { fmtNum as fmt, usd, relTime } from '../observatorio.format';

const CTX_WINDOW = 200_000;

interface UsageRowProps {
  row: SessionUsage;
  maxOut: number;
  title: string;
  openable: boolean;
  onOpen: () => void;
}

export function UsageRow({ row, maxOut, title, openable, onOpen }: UsageRowProps) {
  const fill = Math.min(100, Math.round((row.ctxTokens / CTX_WINDOW) * 100));
  return (
    <tr
      onClick={openable ? onOpen : undefined}
      title={openable ? 'Abrir sessão no chat' : undefined}
      className={`border-b border-neutral-800/60 last:border-0 hover:bg-neutral-900/40 ${openable ? 'cursor-pointer' : ''}`}
    >
      <td className="max-w-0 px-3 py-2">
        <div className="truncate text-neutral-300">{title}</div>
        {row.model && <div className="truncate font-mono text-[10px] text-neutral-600">{row.model}</div>}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-800">
            <div className={`h-full rounded-full ${fill > 75 ? 'bg-red-500' : fill > 50 ? 'bg-amber-500' : 'bg-orange-500'}`} style={{ width: `${fill}%` }} />
          </div>
          <span className="font-mono text-[11px] text-neutral-500">{fmt(row.ctxTokens)}</span>
          {fill >= 75 && (
            <span title="Contexto quase cheio — considere uma nova sessão" className="flex items-center gap-0.5 rounded bg-red-500/10 px-1 text-[9.5px] font-medium text-red-400">
              <Icon name="zap" size={9} /> {fill}%
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.round((row.outputTokens / maxOut) * 100)}%` }} />
          </div>
          <span className="font-mono text-[11px] text-neutral-400">{fmt(row.outputTokens)}</span>
        </div>
      </td>
      <td className="px-3 py-2 font-mono text-[11px] text-emerald-400/80">{usd(row.costUsd)}</td>
      <td className="hidden px-3 py-2 font-mono text-neutral-500 sm:table-cell">{row.samples}</td>
      <td className="px-3 py-2 text-right text-neutral-500">{relTime(row.lastTs)}</td>
    </tr>
  );
}
