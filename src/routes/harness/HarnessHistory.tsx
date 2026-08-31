import { useState } from 'react';
import { Badge, Icon, Markdown } from '../../components/primitives';
import { relPast } from '../../../shared/format';
import type { HarnessTaskView } from '../../../shared/protocol';
import { fmtTaskCost } from './task-cost';

interface Props {
  tasks: HarnessTaskView[];
  activeId?: string;
}

export function HarnessHistory({ tasks, activeId }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const past = tasks.filter((t) => t.id !== activeId);
  if (past.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="px-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-neutral-600">histórico</span>
      {past.map((t) => {
        const open = openId === t.id;
        return (
          <div key={t.id} className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/40">
            <button
              onClick={() => setOpenId(open ? null : t.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-neutral-900"
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.status === 'error' ? 'bg-red-400' : 'bg-green-400'}`} />
              <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-300">{t.prompt}</span>
              {t.model && <Badge tone="neutral">{t.model}</Badge>}
              {t.costUsd != null && <span className="shrink-0 text-[10.5px] tabular-nums text-neutral-500">{fmtTaskCost(t.costUsd)}</span>}
              <span className="shrink-0 text-[10.5px] tabular-nums text-neutral-600">{relPast(t.ts)}</span>
              <Icon name={open ? 'minimize' : 'maximize'} size={11} className="shrink-0 text-neutral-600" />
            </button>
            {open && (
              <div className="border-t border-neutral-800 px-3.5 py-3 text-[12.5px] leading-relaxed text-neutral-300">
                {t.status === 'error'
                  ? <span className="text-red-300">{t.error}</span>
                  : t.resultText ? <Markdown md={t.resultText} /> : <span className="text-neutral-600">sem conteúdo</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
