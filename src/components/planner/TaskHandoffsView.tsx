import type { TaskHandoff } from '../../../shared/planner';
import type { TeamBot } from '../../../shared/protocol';
import { botName } from '../../../shared/team-messages';
import { handoffNote } from '../../../shared/task-handoff';

export function TaskHandoffsView({ handoffs, bots }: { handoffs: TaskHandoff[] | undefined; bots: TeamBot[] }) {
  if (!handoffs?.length) return null;
  const nameOf = (id: string) => botName(bots, id);
  return (
    <section className="flex flex-col gap-1.5" aria-label="Passagens">
      <span className="text-[12px] text-neutral-500">Passagens</span>
      <ul className="flex flex-col gap-2">
        {[...handoffs].reverse().map((h) => (
          <li key={`${h.at}-${h.toBotId}`} className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2">
            <time className="text-[11px] text-neutral-600" dateTime={new Date(h.at).toISOString()}>{new Date(h.at).toLocaleString('pt-BR')}</time>
            <p className="mt-0.5 whitespace-pre-line text-[12px] leading-relaxed text-neutral-300">{handoffNote(h, nameOf)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
