import { useState } from 'react';
import type { TeamBot } from '../../../../shared/protocol';
import { isActive, type HeavyJob } from '../../../../shared/heavy-job';
import { Button } from '../../../components/primitives';
import { Mascot } from '../../../components/team/Mascot';
import { STATUS_LABEL, STATUS_TONE, isHuman, jobDuration } from './executor-view';

interface JobListProps { jobs: HeavyJob[]; bots: TeamBot[]; now: number; canEdit: boolean; onCancel: (id: string) => void }

export function JobChip({ status }: { status: HeavyJob['status'] }) {
  const tone = STATUS_TONE[status];
  return <span className="shrink-0 rounded-full border px-2 py-px text-[11.5px] font-medium" style={{ color: tone, borderColor: `${tone}55`, background: `${tone}1f` }}>{STATUS_LABEL[status]}</span>;
}

function Requester({ job, bots }: { job: HeavyJob; bots: TeamBot[] }) {
  if (isHuman(job)) return <span className="text-neutral-400">você</span>;
  const bot = bots.find((b) => b.id === job.requestedBy);
  if (!bot) return <span className="text-neutral-400">Agente removido</span>;
  return <span className="flex min-w-0 items-center gap-1"><Mascot mascot={bot.mascot} size={18} name={bot.name} /><span className="truncate text-neutral-300">{bot.name}</span></span>;
}

function JobRow({ job, bots, now, canEdit, onCancel }: { job: HeavyJob; bots: TeamBot[]; now: number; canEdit: boolean; onCancel: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const duration = jobDuration(job, now);
  return (
    <li className="min-w-0 rounded-xl border border-neutral-800 bg-neutral-900/70">
      <div className="flex min-w-0 flex-col gap-2 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0 break-all text-[13.5px] font-medium text-neutral-100">{job.repo}@{job.branch}</span>
          <JobChip status={job.status} />
        </div>
        <button
          type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
          className={`w-full min-w-0 rounded-md bg-neutral-950 px-2 py-1.5 text-left font-mono text-[12.5px] text-neutral-200 ${open ? 'whitespace-pre-wrap break-all' : 'truncate'}`}
          title={open ? undefined : job.command}
        >
          {job.command}
        </button>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-neutral-500">
          <Requester job={job} bots={bots} />
          {job.dir && <span className="break-all font-mono">{job.dir}</span>}
          {duration && <span>{duration}</span>}
          {job.exitCode !== undefined && <span>código {job.exitCode}</span>}
          {job.error && <span className="text-red-300">{job.error}</span>}
          {canEdit && isActive(job) && <Button variant="danger" size="xs" className="ml-auto" onClick={() => onCancel(job.id)}>Cancelar</Button>}
        </div>
      </div>
      {open && (
        <pre aria-label="Saída" className="scroll-thin max-h-72 overflow-auto whitespace-pre-wrap break-all border-t border-neutral-800 bg-neutral-950 p-3 font-mono text-[12px] text-neutral-300">
          {job.tail || 'Sem saída ainda.'}
        </pre>
      )}
    </li>
  );
}

export function JobList({ jobs, bots, now, canEdit, onCancel }: JobListProps) {
  if (jobs.length === 0) return <p className="text-[14px] text-neutral-400">Nenhum job ainda. Teste, build e render rodam aqui, na máquina do executor.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {[...jobs].sort((a, b) => b.createdAt - a.createdAt).map((j) => <JobRow key={j.id} job={j} bots={bots} now={now} canEdit={canEdit} onCancel={onCancel} />)}
    </ul>
  );
}
