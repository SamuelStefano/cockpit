import { useState } from 'react';
import type { TeamBot } from '../../../../shared/protocol';
import { groupByDepartment } from '../../../../shared/departments';
import { MEETING_LIMITS, type MeetingInput } from '../../../../shared/team-meeting';
import { Button } from '../../../components/primitives';
import { Mascot } from '../../../components/team/Mascot';
import { MEETING_ACCENT, botBlock, defaultModeratorId, formBlock, submitBlock } from './meeting-view';

interface NewMeetingFormProps { bots: TeamBot[]; canEdit: boolean; onStart: (input: MeetingInput) => void; onCancel: () => void }

export function NewMeetingForm({ bots, canEdit, onStart, onCancel }: NewMeetingFormProps) {
  const [question, setQuestion] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [moderatorId, setModeratorId] = useState(() => defaultModeratorId(bots.filter((b) => !botBlock(b))));
  const formReason = formBlock(canEdit, bots);
  const reason = formReason ?? submitBlock(question, picked.length);
  const full = picked.length >= MEETING_LIMITS.maxParticipants;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <form
      className="flex min-w-0 flex-col gap-4"
      onSubmit={(e) => { e.preventDefault(); if (!reason) onStart({ question: question.trim(), participantIds: picked, moderatorId }); }}
    >
      <label className="flex flex-col gap-1.5 text-[13px] text-neutral-300">
        Pergunta da reunião
        <textarea
          value={question} maxLength={MEETING_LIMITS.question} rows={4} disabled={formReason !== null}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-900 p-2.5 text-[14px] text-neutral-100 outline-none focus:border-violet-400 disabled:opacity-50"
        />
        <span className="text-[11.5px] text-neutral-500">{question.length}/{MEETING_LIMITS.question}</span>
      </label>
      <fieldset className="flex min-w-0 flex-col gap-3" disabled={formReason !== null}>
        <legend className="mb-1 text-[13px] text-neutral-300">Participantes ({picked.length} de {MEETING_LIMITS.minParticipants} a {MEETING_LIMITS.maxParticipants})</legend>
        {groupByDepartment(bots, (b) => b.department).map(({ department, items }) => (
          <div key={department?.id ?? 'none'} role="group" aria-label={department?.name ?? 'Sem setor'} className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: department?.color ?? '#737373' }}>{department?.name ?? 'Sem setor'}</span>
            <div className="flex flex-wrap gap-2">
              {items.map((b) => {
                const block = botBlock(b);
                const on = picked.includes(b.id);
                const off = formReason !== null || block !== null || (full && !on);
                return (
                  <button
                    key={b.id} type="button" role="checkbox" aria-checked={on} disabled={off} title={block ?? undefined}
                    onClick={() => toggle(b.id)}
                    className="flex min-w-0 max-w-full items-center gap-2 rounded-full border py-1 pl-1.5 pr-3 text-left text-[13px] transition disabled:opacity-40"
                    style={on ? { borderColor: MEETING_ACCENT, background: `${MEETING_ACCENT}26`, color: '#ede9fe' } : { borderColor: '#262626', color: '#d4d4d4' }}
                  >
                    <Mascot mascot={b.mascot} size={24} name={b.name} />
                    <span className="min-w-0 truncate"><b className="font-semibold">{b.name}</b>{b.label ? <span className="text-neutral-400"> · {b.label}</span> : null}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1.5 text-[13px] text-neutral-300">
        Moderador (escreve a ata)
        <select
          value={moderatorId} disabled={formReason !== null} onChange={(e) => setModeratorId(e.target.value)}
          className="h-9 w-full max-w-xs rounded-lg border border-neutral-800 bg-neutral-900 px-2 text-[14px] text-neutral-100 disabled:opacity-50"
        >
          {bots.filter((b) => !botBlock(b)).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" size="sm" disabled={reason !== null}>Abrir reunião</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        {reason && <span role="status" className="text-[12.5px] text-neutral-500">{reason}</span>}
      </div>
    </form>
  );
}
