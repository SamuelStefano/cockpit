import { useState } from 'react';
import type { JobInput } from '../../../../shared/heavy-job';
import { Button } from '../../../components/primitives';
import { FIELD_MAX, formBlock, submitBlock, toInput } from './executor-view';

interface RunFormProps { canEdit: boolean; configured: boolean; onRun: (input: JobInput) => void }

const field = 'h-9 w-full min-w-0 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 text-[14px] text-neutral-100 outline-none focus:border-sky-400 disabled:opacity-50';

export function RunForm({ canEdit, configured, onRun }: RunFormProps) {
  const [f, setF] = useState({ repo: '', branch: '', dir: '', command: '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const formReason = formBlock(canEdit, configured);
  const reason = formReason ?? submitBlock(f);
  return (
    <form
      aria-label="Rodar no executor" className="flex min-w-0 flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-3.5"
      onSubmit={(e) => { e.preventDefault(); if (!reason) { onRun(toInput(f)); setF((p) => ({ ...p, command: '' })); } }}
    >
      <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-neutral-400">Rodar</h2>
      <fieldset className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3" disabled={formReason !== null}>
        <label className="flex min-w-0 flex-col gap-1 text-[13px] text-neutral-300">Repositório
          <input value={f.repo} maxLength={FIELD_MAX.repo} onChange={set('repo')} placeholder="org/repo" className={field} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[13px] text-neutral-300">Branch
          <input value={f.branch} maxLength={FIELD_MAX.branch} onChange={set('branch')} placeholder="feat/minha-branch" className={field} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[13px] text-neutral-300">Pasta (opcional)
          <input value={f.dir} maxLength={FIELD_MAX.dir} onChange={set('dir')} placeholder="packages/web" className={field} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[13px] text-neutral-300 sm:col-span-3">Comando
          <input value={f.command} maxLength={FIELD_MAX.command} onChange={set('command')} placeholder="npm test" className={`${field} font-mono`} />
        </label>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" size="sm" disabled={reason !== null}>Rodar no executor</Button>
        {reason && <span role="status" className="min-w-0 text-[12.5px] text-neutral-500">{reason}</span>}
      </div>
    </form>
  );
}
