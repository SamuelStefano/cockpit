import { useMemo, useState } from 'react';
import type { TeamBot } from '../../../shared/protocol';
import { MEETING_LIMITS, validateMeetingInput, type MeetingInput } from '../../../shared/team-meeting';
import { botBlock, defaultModeratorId } from '../agentes-office/meetings/meeting-view';

interface MeetingPanelProps {
  bots: TeamBot[];
  running: boolean;
  picked: string[];
  onPick: (ids: string[]) => void;
  onStart: (input: MeetingInput) => void;
  onClose: () => void;
}

const btn = 'rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-40 pointer-coarse:min-h-11';

// Convocar = the same `team-meeting-start` frame `deckctl meeting start` sends.
export function MeetingPanel({ bots, running, picked, onPick, onStart, onClose }: MeetingPanelProps) {
  const [question, setQuestion] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const eligible = useMemo(() => bots.filter((b) => !botBlock(b)), [bots]);
  const moderatorId = picked.includes(defaultModeratorId(eligible)) ? defaultModeratorId(eligible) : (picked[0] ?? '');
  const check = validateMeetingInput({ question, participantIds: picked, moderatorId }, bots);
  const toggle = (id: string) => onPick(picked.includes(id) ? picked.filter((x) => x !== id) : picked.length >= MEETING_LIMITS.maxParticipants ? picked : [...picked, id]);
  const start = () => { if (check.ok) { onStart(check.input); setNote('Reunião convocada'); } };
  return (
    <div className="absolute right-2 top-12 z-10 flex max-h-[calc(100%-4rem)] w-72 max-w-[calc(100%-1rem)] flex-col gap-2 overflow-y-auto rounded-xl border border-white/10 bg-neutral-950/90 p-3 text-xs text-neutral-200 backdrop-blur">
      <div className="flex items-center justify-between">
        <b className="text-[13px]">Sala de Reunião</b>
        <button type="button" aria-label="Fechar" className="px-1 text-neutral-400 hover:text-white" onClick={onClose}>×</button>
      </div>
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="mb-1 text-neutral-400">Clique nos bots no mundo ou aqui · ({picked.length} de {MEETING_LIMITS.minParticipants} a {MEETING_LIMITS.maxParticipants})</legend>
        {eligible.map((b) => {
          const on = picked.includes(b.id);
          return (
            <button
              key={b.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(b.id)}
              className={`rounded-full border px-2.5 py-1 pointer-coarse:min-h-9 ${on ? 'border-violet-400 bg-violet-500/20 text-violet-100' : 'border-neutral-700 text-neutral-300'}`}
            >{b.name}</button>
          );
        })}
      </fieldset>
      <label className="flex flex-col gap-1 text-neutral-400">
        Pergunta
        <textarea
          value={question} maxLength={MEETING_LIMITS.question} rows={3} onChange={(e) => { setQuestion(e.target.value); setNote(null); }}
          className="w-full resize-none rounded-md border border-neutral-800 bg-neutral-900 p-2 text-[13px] text-neutral-100 outline-none focus:border-violet-400"
        />
      </label>
      <div className="flex items-center gap-2">
        <button type="button" className={`${btn} border-violet-400/60 bg-violet-500/25 text-violet-100`} disabled={!check.ok || running} onClick={start}>Convocar</button>
      </div>
      <p className="min-h-4 text-[11px] text-neutral-400">{running ? 'Há uma reunião em andamento.' : note ?? (check.ok ? '' : check.error)}</p>
    </div>
  );
}
