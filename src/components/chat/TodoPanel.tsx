import { useState } from 'react';
import { Icon, tokens } from '../primitives';
import type { ToolTodo } from '../../data/mock';

interface TodoPanelProps {
  todos: ToolTodo[];
}

const COLLAPSE_AFTER = 6;

export function TodoPanel({ todos }: TodoPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const done = todos.filter((t) => t.status === 'completed').length;
  const hidden = todos.length - COLLAPSE_AFTER;
  // Em progresso primeiro, depois pendentes, concluídas por último — espelha o
  // foco do Claude Code (o que está rolando agora fica no topo).
  const shown = showAll ? todos : todos.slice(0, COLLAPSE_AFTER);

  return (
    <div className="px-3 pb-2">
      <div className="rounded-md border border-neutral-800 bg-[#0c0c0c] px-3 py-2">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
          <Icon name="check" size={12} className="text-orange-400" />
          tarefas · {done}/{todos.length}
        </div>
        <ul className="flex flex-col gap-1">
          {shown.map((t, i) => (
            <TodoRow key={i} todo={t} />
          ))}
        </ul>
        {hidden > 0 && (
          <button
            onClick={() => setShowAll((s) => !s)}
            className={`mt-1.5 rounded text-[11px] text-neutral-600 transition hover:text-neutral-400 ${tokens.focusRing}`}
          >
            {showAll ? 'mostrar menos' : `mostrar todas (+${hidden})`}
          </button>
        )}
      </div>
    </div>
  );
}

function TodoRow({ todo }: { todo: ToolTodo }) {
  const { status } = todo;
  const label = status === 'in_progress' && todo.activeForm ? todo.activeForm : todo.content;
  const icon = status === 'completed' ? 'check' : status === 'in_progress' ? 'rotate' : 'circle';
  const iconCls = status === 'completed' ? 'text-green-400' : status === 'in_progress' ? 'spin text-orange-400' : 'text-neutral-600';
  const textCls = status === 'completed' ? 'text-neutral-500 line-through'
    : status === 'in_progress' ? 'text-neutral-100' : 'text-neutral-400';
  return (
    <li className="flex items-start gap-2 text-[12px] leading-relaxed">
      <Icon name={icon} size={13} className={`mt-0.5 shrink-0 ${iconCls}`} />
      <span className={textCls}>{label}</span>
    </li>
  );
}
