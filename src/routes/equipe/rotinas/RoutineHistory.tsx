import type { TeamBot } from '../../../../shared/protocol';
import { Button } from '../../../components/primitives';
import type { HistoryItem } from './routine-view';

interface RoutineHistoryProps {
  items: HistoryItem[];
  bots: TeamBot[];
  onChat: (botId: string) => void;
  onRun: (id: string) => void;
}

const TONE = { ok: 'bg-emerald-400', err: 'bg-red-400', muted: 'bg-neutral-600' };
const TEXT = { ok: 'text-neutral-400', err: 'text-red-400', muted: 'text-neutral-500' };
const COLS = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1.1fr)_130px]';

export function RoutineHistory({ items, bots, onChat, onRun }: RoutineHistoryProps) {
  if (!items.length) return <p className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-5 text-[13px] text-neutral-500">Nada rodou ainda. Quando uma rotina disparar, ela aparece aqui.</p>;
  return (
    <div className="hairline overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50">
      <div className={`${COLS} hidden h-9 border-b border-neutral-800/70 text-[11px] uppercase tracking-[0.06em] text-neutral-500 md:grid`}>
        <span>Quando</span><span>Rotina</span><span>Resultado</span><span />
      </div>
      {items.map((h) => {
        const chat = h.botId && bots.some((b) => b.id === h.botId) ? h.botId : null;
        return (
          <div key={h.id} className={`${COLS} min-h-11 border-b border-neutral-800/70 py-2 text-[13px] last:border-b-0`}>
            <span className="order-2 text-neutral-500 md:order-none">{h.when}</span>
            <span className="order-1 truncate text-neutral-200 md:order-none">{h.name}</span>
            <span className={`order-3 flex items-center gap-1.5 md:order-none ${TEXT[h.result.tone]}`}>
              <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE[h.result.tone]}`} />{h.result.text}
            </span>
            <span className="order-4 col-start-2 row-start-1 flex justify-end md:order-none md:col-auto md:row-auto">
              {h.failed && <Button variant="ghost" size="sm" onClick={() => onRun(h.id)}>Rodar agora</Button>}
              {chat && <Button variant="ghost" size="sm" onClick={() => onChat(chat)}>Ver conversa</Button>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
