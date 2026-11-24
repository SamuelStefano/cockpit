import type { TeamBot } from '../../../../shared/protocol';
import { answerOf, type TeamMeeting } from '../../../../shared/team-meeting';
import { Mascot } from '../../../components/team/Mascot';
import type { BotState } from '../../../components/team/botState';
import { StatusChip } from './MeetingList';
import { MEETING_ACCENT, SEAT_LABEL, seatState } from './meeting-view';

interface MeetingViewProps { meeting: TeamMeeting; bots: TeamBot[] }

export function MeetingView({ meeting, bots }: MeetingViewProps) {
  const seat = (id: string) => bots.find((b) => b.id === id);
  const nameOf = (id: string) => seat(id)?.name ?? 'Agente removido';
  const live = meeting.status === 'round1' || meeting.status === 'round2' || meeting.status === 'minutes';
  const showRound2 = meeting.status !== 'round1' && (meeting.status !== 'failed' || meeting.answers.some((a) => a.round === 2));
  return (
    <article className="flex min-w-0 flex-col gap-5">
      <header className="flex min-w-0 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 break-words text-[18px] font-semibold text-neutral-50">{meeting.question}</h2>
          <StatusChip status={meeting.status} />
        </div>
        <div aria-label="Mesa" role="group" className="flex flex-wrap items-end gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: `${MEETING_ACCENT}40`, background: `${MEETING_ACCENT}10` }}>
          {meeting.participantIds.map((id) => {
            const bot = seat(id);
            const writing = live && seatState(meeting, id, meeting.status === 'round2' ? 2 : 1) === 'writing';
            const state: BotState = writing ? 'working' : 'idle';
            return (
              <span key={id} className="flex min-w-0 flex-col items-center gap-0.5">
                {bot ? <Mascot mascot={bot.mascot} size={36} state={state} name={bot.name} /> : <span className="size-9 rounded-full bg-neutral-800" />}
                <span className="max-w-20 truncate text-[11.5px] text-neutral-300">{nameOf(id)}</span>
              </span>
            );
          })}
        </div>
      </header>

      <Round title="Rodada 1" hint="às cegas: ninguém vê a resposta do outro" meeting={meeting} round={1} nameOf={nameOf} />
      {showRound2 && <Round title="Rodada 2" hint="depois de ver os outros" meeting={meeting} round={2} nameOf={nameOf} />}

      {meeting.minutes !== undefined && (
        <section aria-label="Ata" className="flex flex-col gap-2">
          <h3 className="text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: MEETING_ACCENT }}>Ata · {nameOf(meeting.moderatorId)}</h3>
          <p className="whitespace-pre-wrap break-words rounded-xl border border-neutral-800 bg-neutral-900/70 p-3.5 text-[14px] leading-relaxed text-neutral-100">{meeting.minutes}</p>
        </section>
      )}
      {meeting.status === 'minutes' && <p className="text-[13px] text-neutral-400">{nameOf(meeting.moderatorId)} está escrevendo a ata…</p>}
      {meeting.status === 'failed' && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[13.5px] text-red-300">A reunião falhou: {meeting.error ?? 'erro desconhecido'}</p>
      )}
    </article>
  );
}

function Round({ title, hint, meeting, round, nameOf }: { title: string; hint: string; meeting: TeamMeeting; round: 1 | 2; nameOf: (id: string) => string }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2">
      <h3 className="text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: MEETING_ACCENT }}>{title} <span className="font-normal normal-case tracking-normal text-neutral-500">· {hint}</span></h3>
      <ul className="flex flex-col gap-2">
        {meeting.participantIds.map((id) => {
          const state = seatState(meeting, id, round);
          const text = state === 'shown' ? answerOf(meeting, id, round)?.text : undefined;
          return (
            <li key={id} className="min-w-0 rounded-xl border border-neutral-800 bg-neutral-900/70 p-3">
              <p className="text-[13px] font-semibold text-neutral-200">{nameOf(id)}</p>
              {text !== undefined
                ? <p className="mt-1 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-neutral-300">{text}</p>
                : <p className="mt-1 text-[13px] text-neutral-500">{SEAT_LABEL[state]}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
