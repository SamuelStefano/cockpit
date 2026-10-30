import { Badge } from '../components/primitives';
import { CALL_QUESTS } from './sala/quests';

export function SalaQuests() {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2">
      {CALL_QUESTS.map((q) => {
        const body = (
          <>
            <Badge tone={q.tone}>{q.tone === 'red' ? 'você' : q.tone === 'yellow' ? 'espera' : 'aberta'}</Badge>
            <p className="mt-1 text-[13px] font-medium text-neutral-100">{q.title}</p>
            <p className="text-[11px] leading-snug text-neutral-500">{q.detail}</p>
          </>
        );
        const cls = 'min-w-40 max-w-52 shrink-0 rounded-xl border border-neutral-800 bg-neutral-900/80 px-3 py-2';
        return q.href
          ? <a key={q.title} href={q.href} target="_blank" rel="noreferrer" className={cls}>{body}</a>
          : <div key={q.title} className={cls}>{body}</div>;
      })}
    </div>
  );
}
