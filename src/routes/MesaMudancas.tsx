import type { Message } from '../../shared/protocol';
import { mesaChanges } from './mesa/changes';

const TONE = { running: 'text-orange-300', done: 'text-emerald-300', error: 'text-red-300' };

export function MesaMudancas({ messages }: { messages: Message[] }) {
  const cards = mesaChanges(messages).slice().reverse();
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <h2 className="px-3 pt-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Alterações</h2>
      {cards.length === 0 && <p className="px-3 py-3 text-[13px] text-neutral-500">Quando o agente editar ou rodar algo, aparece aqui.</p>}
      <ul className="scroll-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2">
        {cards.map((card) => (
          <li key={card.id} className={`rounded-2xl border border-neutral-800 bg-neutral-900/70 px-3 py-2 ${card.status === 'running' ? 'border-l-2 border-l-orange-400' : card.status === 'error' ? 'border-l-2 border-l-red-400' : 'border-l-2 border-l-emerald-500/70'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[12px] text-neutral-100">{card.title}</span>
              <span className={`shrink-0 text-[10px] uppercase ${TONE[card.status]}`}>{card.status === 'running' ? 'ao vivo' : card.status === 'done' ? 'feito' : 'falhou'}</span>
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-neutral-500">{card.kind}</p>
            {card.line && <pre className="mt-1 truncate font-mono text-[11px] text-neutral-400">{card.line}</pre>}
          </li>
        ))}
      </ul>
    </section>
  );
}
