import { useState } from 'react';
import { Icon, Markdown, tokens } from '../primitives';
import { usePersisted } from '../../lib/persist';
import type { ToolCall } from '../../data/mock';
import { DiffView } from './DiffView';
import { TodoPanel } from './TodoPanel';
import { CopyTextButton } from './MessageActions';
import { permissionDeniedTool } from './permission-deny';

interface ToolCallCardProps {
  tool: ToolCall;
}

export function ToolCallCard({ tool }: ToolCallCardProps) {
  const [open, setOpen] = useState(!!tool.expanded);
  const [showShellCmd, setShowShellCmd] = usePersisted('showShellCmd', true);
  const { status } = tool;
  const lines = tool.output || [];
  const deniedTool = status === 'error' ? permissionDeniedTool(lines) : null;

  const statusEl = {
    running: (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-400">
        <Icon name="rotate" size={12} className="spin text-orange-400" /> rodando…
      </span>
    ),
    done: (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-green-400">
        <Icon name="check" size={13} /> ok{tool.durationMs !== undefined && ` ${(tool.durationMs / 1000).toFixed(1)}s`}
      </span>
    ),
    error: (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-red-400">
        <Icon name="x" size={13} /> falhou (exit {tool.exit ?? 1})
      </span>
    ),
  }[status];

  const ring = status === 'error' ? 'border-red-500/30' : status === 'running' ? 'border-orange-500/30' : 'border-neutral-800';

  // Bash mostra prompt `$`; ferramentas de arquivo (Read/Edit/…) trazem um path
  // no campo command — `$` ali confunde, então usam ícone de arquivo.
  const kind = (tool.name || tool.label || '').toLowerCase();
  const isShell = kind === 'bash' || kind === 'shell' || kind === 'sh';
  const isAgent = kind === 'task' || kind === 'agent';
  const headIcon = isShell ? 'terminal'
    : kind === 'read' ? 'file'
    : kind === 'edit' || kind === 'write' || kind === 'multiedit' || kind === 'notebookedit' ? 'pencil'
    : kind === 'grep' || kind === 'glob' || kind === 'websearch' || kind === 'webfetch' ? 'search'
    : isAgent ? 'sparkles'
    : kind === 'todowrite' || kind === 'taskcreate' || kind === 'taskupdate' ? 'check'
    : 'terminal';
  // Subagent/task carregam um TÍTULO no command, não um path — o ícone de
  // arquivo ali sugeria caminho e confundia.
  const cmdIcon = isAgent || kind === 'taskcreate' || kind === 'taskupdate' ? headIcon : 'file';

  return (
    <div className={`my-2 overflow-hidden rounded-xl border ${ring} bg-neutral-900/70`}>
      <div className="flex items-center gap-2.5 px-3 py-2">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${status === 'error' ? 'bg-red-500/15 text-red-400' : 'bg-neutral-800 text-orange-400'}`}>
          <Icon name={headIcon} size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-[12px] font-medium text-neutral-200">{tool.label}</span>
            <span className="shrink-0">{statusEl}</span>
          </div>
        </div>
      </div>
      {tool.command && (isShell && !showShellCmd ? (
        <div className="px-3 pb-2">
          <button
            onClick={() => setShowShellCmd(true)}
            title="Comandos de shell ocultos. Clique para voltar a mostrá-los."
            className={`flex items-center gap-1.5 rounded-md border border-dashed border-neutral-800 px-2.5 py-1 font-mono text-[11px] text-neutral-600 transition hover:border-neutral-700 hover:text-neutral-400 ${tokens.focusRing}`}
          >
            <span className="select-none text-orange-500/50">$</span> comando oculto · mostrar
          </button>
        </div>
      ) : (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-[#0c0c0c] px-2.5 py-1.5">
            {isShell
              ? <span className="select-none font-mono text-[11px] text-orange-500/70">$</span>
              : <Icon name={cmdIcon} size={12} className="shrink-0 text-neutral-500" />}
            <code className="scroll-thin overflow-x-auto whitespace-nowrap font-mono text-[11.5px] text-neutral-300">{tool.command}</code>
            {isShell && (
              <button
                onClick={() => setShowShellCmd(false)}
                title="Ocultar comandos de shell por padrão"
                className={`ml-auto shrink-0 rounded text-neutral-600 transition hover:text-neutral-300 ${tokens.focusRing}`}
              >
                <Icon name="x" size={12} />
              </button>
            )}
          </div>
        </div>
      ))}
      {deniedTool && (
        <div className="px-3 pb-2">
          <div className="flex items-start gap-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-[12px] leading-relaxed text-amber-200">
            <Icon name="shield" size={13} className="mt-0.5 shrink-0 text-amber-400" />
            <span>
              Permissão negada pra <code className="font-mono text-[11.5px] text-amber-100">{deniedTool}</code>.
              O modo atual não deixa o agente usar essa ferramenta — troque no seletor de modo
              junto ao campo de mensagem (Executar, ou Bypass se for admin) e reenvie.
            </span>
          </div>
        </div>
      )}
      {tool.diff && <DiffView diff={tool.diff} />}
      {tool.todos && tool.todos.length > 0 && <TodoPanel todos={tool.todos} />}
      {tool.markdown && (
        <div className="px-3 pb-2">
          <div className="rounded-md border border-neutral-800 bg-[#0c0c0c] px-3 py-2 text-[13px] leading-relaxed text-neutral-300">
            <Markdown md={tool.markdown} />
          </div>
        </div>
      )}
      {lines.length > 0 && (
        <div className="border-t border-neutral-800">
          <div className="flex items-center pr-2">
            <button
              onClick={() => setOpen(o => !o)}
              className={`flex flex-1 items-center gap-1.5 px-3 py-1.5 text-[11px] text-neutral-500 transition hover:text-neutral-300 ${tokens.focusRing}`}
            >
              <Icon name="chevronDown" size={13} className="transition-transform duration-200" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
              {open ? 'ocultar output' : `mostrar output (${lines.length} linhas)`}
            </button>
            {open && <CopyTextButton text={lines.join('\n')} />}
          </div>
          <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
            <pre className="scroll-thin max-h-52 overflow-auto border-t border-neutral-800 bg-[#070707] px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-neutral-400">
              {lines.map((l, i) => (
                <div key={i} className={l.startsWith('##') || l.startsWith('?') ? 'text-sky-400/80' : l.startsWith(' M') ? 'text-orange-400/80' : ''}>{l || ' '}</div>
              ))}
            </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
