import { AgentDesk } from './AgentDesk';
import { isLive, type OfficeRoom } from './office-view';

export function DepartmentRoom({ room, onOpen }: { room: OfficeRoom; onOpen: (id: string) => void }) {
  const color = room.department?.color ?? '#525252';
  const name = room.department?.name ?? 'Sem setor';
  const n = room.entries.length;
  const live = room.entries.filter(({ view }) => isLive(view.state)).length;
  return (
    <section aria-label={name} className="relative mb-3.5 min-w-0 break-inside-avoid rounded-2xl border border-neutral-800 px-4 py-3" style={{ background: `linear-gradient(180deg, ${color}14 0%, rgba(23,23,23,0.4) 72px)` }}>
      <span aria-hidden className="absolute bottom-3.5 left-0 top-3.5 w-0.75 rounded-full" style={{ background: color }} />
      <h2 className="mb-2.5 flex items-baseline justify-between gap-2 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color }}>
        <span className="truncate">{name}</span>
        <span className="shrink-0 font-medium normal-case tracking-normal text-neutral-500">{n} {n === 1 ? 'agente' : 'agentes'}{live > 0 && <span className="text-green-400"> · {live} trabalhando</span>}</span>
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {room.entries.map(({ view, depth }) => <AgentDesk key={view.bot.id} view={view} isLeader={room.leaders.has(view.bot.id)} wide={n === 1 || (depth === 0 && room.leaders.has(view.bot.id))} onOpen={onOpen} />)}
      </div>
    </section>
  );
}
