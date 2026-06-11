import { useState } from 'react';
import { Icon, tokens } from '../primitives';
import type { ToolCall } from '../../data/mock';
import { ToolCallCard } from './ToolCallCard';

interface ToolGroupCardProps {
  tools: ToolCall[];
}

// Agrupa as ferramentas de um turno numa linha só (resumo + status), expansível
// pra ver os comandos individuais. Sem isto, uma pesquisa com 5+ greps/reads
// polui o chat. O ToolCallCard solo segue pra grupos de 1.
export function ToolGroupCard({ tools }: ToolGroupCardProps) {
  const [open, setOpen] = useState(false);

  const anyRunning = tools.some((t) => t.status === 'running');
  const anyError = tools.some((t) => t.status === 'error');
  const status: ToolCall['status'] = anyError ? 'error' : anyRunning ? 'running' : 'done';
  const totalMs = tools.reduce((s, t) => s + (t.durationMs ?? 0), 0);
  const hasMs = tools.some((t) => t.durationMs !== undefined);

  const counts = new Map<string, number>();
  for (const t of tools) {
    const k = labelKind(t.name || t.label);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const breakdown = [...counts.entries()].map(([k, n]) => `${n} ${k}`).join(' · ');

  const ring = status === 'error' ? 'border-red-500/30' : status === 'running' ? 'border-orange-500/30' : 'border-neutral-800';
  const statusEl = status === 'running'
    ? <span className="flex items-center gap-1 text-[10.5px] font-medium text-neutral-400"><Icon name="rotate" size={11} className="spin text-orange-400" /> rodando…</span>
    : status === 'error'
    ? <span className="flex items-center gap-1 text-[10.5px] font-medium text-red-400"><Icon name="x" size={12} /> {tools.filter((t) => t.status === 'error').length} falhou</span>
    : <span className="flex items-center gap-1 text-[10.5px] font-medium text-green-400"><Icon name="check" size={12} /> ok{hasMs ? ` ${(totalMs / 1000).toFixed(1)}s` : ''}</span>;

  return (
    <div className={`my-2 overflow-hidden rounded-xl border ${ring} bg-neutral-900/70`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-neutral-900 ${tokens.focusRing}`}
      >
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${status === 'error' ? 'bg-red-500/15 text-red-400' : 'bg-neutral-800 text-orange-400'}`}>
          <Icon name="terminal" size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[12px] font-medium text-neutral-200">
              {tools.length} ações
            </span>
            <span className="shrink-0">{statusEl}</span>
          </div>
          <span className="block truncate text-[10.5px] text-neutral-500">{breakdown}</span>
        </div>
        <Icon
          name="chevronDown"
          size={14}
          className="shrink-0 text-neutral-500 transition-transform duration-200"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="border-t border-neutral-800 px-3 pb-1.5 pt-0.5">
            {tools.map((t) => <ToolCallCard key={t.id} tool={t} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// "Bash" → "Bash", "read" → "Read". Nome curto da ferramenta pro resumo.
function labelKind(raw: string): string {
  const k = (raw || 'tool').trim();
  return k.charAt(0).toUpperCase() + k.slice(1);
}
