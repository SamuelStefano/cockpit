import type { TeamBot } from '../../../../shared/protocol';
import type { TeamMeeting } from '../../../../shared/team-meeting';
import { Mascot } from '../../../components/team/Mascot';
import { MEETING_ACCENT, STATUS_LABEL } from './meeting-view';

interface MeetingListProps { meetings: TeamMeeting[]; bots: TeamBot[]; onOpen: (id: string) => void }

export function StatusChip({ status }: { status: TeamMeeting['status'] }) {
  const tone = status === 'failed' ? '#f87171' : status === 'done' ? '#4ade80' : MEETING_ACCENT;
  return <span className="shrink-0 rounded-full border px-2 py-px text-[11.5px] font-medium" style={{ color: tone, borderColor: `${tone}55`, background: `${tone}1f` }}>{STATUS_LABEL[status]}</span>;
}

export function MeetingList({ meetings, bots, onOpen }: MeetingListProps) {
  if (meetings.length === 0) return <p className="text-[14px] text-neutral-400">Nenhuma reunião ainda. Abra uma para ouvir a equipe em rodadas às cegas.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {[...meetings].sort((a, b) => b.createdAt - a.createdAt).map((m) => (
        <li key={m.id}>
          <button type="button" onClick={() => onOpen(m.id)} className="flex w-full min-w-0 flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900/70 p-3.5 text-left transition hover:border-neutral-700 hover:bg-neutral-800/60">
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0 break-words text-[14.5px] font-medium text-neutral-100">{m.question}</span>
              <StatusChip status={m.status} />
            </span>
            <span className="flex items-center gap-1">
              {m.participantIds.map((id) => {
                const bot = bots.find((b) => b.id === id);
                return bot ? <Mascot key={id} mascot={bot.mascot} size={22} name={bot.name} /> : null;
              })}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
