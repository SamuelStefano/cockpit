import { useEffect, useState } from 'react';
import type { TeamBot } from '../../../../shared/protocol';
import type { ExecutorState, HeavyJob, JobInput } from '../../../../shared/heavy-job';
import { ExecutorStatus } from './ExecutorStatus';
import { JobList } from './JobList';
import { RunForm } from './RunForm';

interface ExecutorTabProps {
  executor: ExecutorState;
  jobs: HeavyJob[];
  bots: TeamBot[];
  canEdit: boolean;
  onRun: (input: JobInput) => void;
  onCancel: (id: string) => void;
}

const TICK_MS = 15_000;

export function ExecutorTab({ executor, jobs, bots, canEdit, onRun, onCancel }: ExecutorTabProps) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ExecutorStatus state={executor} now={now} />
      <RunForm canEdit={canEdit} configured={executor.configured} onRun={onRun} />
      <JobList jobs={jobs} bots={bots} now={now} canEdit={canEdit} onCancel={onCancel} />
    </div>
  );
}
