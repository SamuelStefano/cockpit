import { useState } from 'react';
import { Icon, tokens } from '../primitives';
import type { ToolCall } from '../../data/types';
import { ToolCallCard } from './ToolCallCard';
import { activityIcons, activityPhrase } from './activity-summary';
import { fmtToolDuration } from './message-format';

interface ActivityRowProps {
  tools: ToolCall[];
}

function itemStatus(t: ToolCall): { text: string; cls: string } {
  if (t.status === 'running') return { text: 'rodando…', cls: 'text-orange-400' };
  if (t.status === 'error') return { text: 'falhou', cls: 'text-red-400' };
  return { text: t.durationMs !== undefined ? `ok, ${fmtToolDuration(t.durationMs)}` : 'ok', cls: 'text-neutral-600' };
}

export function ActivityRow({ tools }: ActivityRowProps) {
  const [manual, setManual] = useState<boolean | null>(null);
  const [detail, setDetail] = useState<Record<string, boolean>>({});
  const anyRunning = tools.some((t) => t.status === 'running');
  const failed = tools.filter((t) => t.status === 'error').length;
  const open = manual ?? anyRunning;

  return (
    <div className="my-1">
      <button
        onClick={() => setManual(!open)}
        aria-expanded={open}
        className={`flex h-[30px] max-w-full items-center gap-2 border bg-transparent pl-2 pr-2.5 text-left text-[13px] text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300 ${open ? 'rounded-t-md' : 'rounded-md'} ${failed ? 'border-red-500/30' : 'border-neutral-800'} ${tokens.focusRing}`}
      >
        <span className="flex shrink-0 gap-0.5">
          {activityIcons(tools).map((name) => <Icon key={name} name={name} size={14} />)}
        </span>
        <span className="min-w-0 truncate">{activityPhrase(tools)}</span>
        {failed > 0 && <span className="shrink-0 text-[12px] text-red-400">{failed} falhou</span>}
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} className="shrink-0" />
      </button>
      {open && (
        <div className={`flex w-full min-w-0 flex-col gap-1 rounded-b-md border border-t-0 px-2.5 py-1.5 font-mono text-[12px] text-neutral-500 sm:w-fit sm:min-w-80 ${failed ? 'border-red-500/30' : 'border-neutral-800'}`}>
          {tools.map((t) => {
            const st = itemStatus(t);
            const expanded = !!detail[t.id];
            return (
              <div key={t.id}>
                <button
                  onClick={() => setDetail((d) => ({ ...d, [t.id]: !d[t.id] }))}
                  aria-expanded={expanded}
                  className={`flex w-full min-w-0 items-baseline gap-1.5 rounded-sm text-left hover:text-neutral-300 ${tokens.focusRing}`}
                >
                  <span className="min-w-0 truncate text-neutral-300">{t.command || t.label || t.name}</span>
                  <span className={`shrink-0 ${st.cls}`}>· {st.text}</span>
                </button>
                {expanded && <div className="mt-1 font-sans"><ToolCallCard tool={t} /></div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
