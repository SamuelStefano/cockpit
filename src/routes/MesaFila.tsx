import { useState } from 'react';
import type { QueueItem } from '../useCockpit';
import type { Session } from '../data/types';
import type { ToolTodo } from '../../shared/protocol';
import { Button } from '../components/primitives';

const TODO_TONE: Record<ToolTodo['status'], string> = {
  in_progress: 'bg-orange-400',
  pending: 'bg-neutral-600',
  completed: 'bg-emerald-400',
};

interface Props {
  sessions: Session[];
  running: Set<string>;
  activeId: string;
  onOpen: (id: string) => void;
  todos: ToolTodo[];
  queue: QueueItem[];
  onMove: (sessionKey: string, id: string, dir: -1 | 1) => void;
  onRemove: (sessionKey: string, id: string) => void;
  onRunNow: (sessionKey: string, id: string) => void;
  onEdit: (sessionKey: string, id: string, text: string) => void;
  paused: boolean;
  onTogglePause: () => void;
}

const itemKey = (item: QueueItem) => `${item.sessionKey}:${item.id}`;

export function MesaFila({ sessions, running, activeId, onOpen, todos, queue, onMove, onRemove, onRunNow, onEdit, paused, onTogglePause }: Props) {
  const live = sessions.filter((s) => running.has(s.id));
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  return (
    <aside className="order-2 flex min-h-0 flex-col gap-4 overflow-y-auto border-b border-neutral-800 p-3 lg:order-1 lg:border-b-0 lg:border-r">
      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-orange-300">Agora</h2>
        {live.length === 0 && <p className="text-[13px] text-neutral-500">Nenhum turno em campo.</p>}
        <ul className="flex flex-col gap-2">
          {live.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onOpen(s.id)}
                className={`w-full rounded-2xl border px-3 py-3 text-left ${s.id === activeId ? 'border-orange-400/70 bg-orange-500/10' : 'border-neutral-800 bg-neutral-900/70'}`}
              >
                <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-orange-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
                  em campo
                </span>
                <span className="mt-1 block text-[14px] font-semibold text-neutral-100">{s.title || 'chat'}</span>
                <span className="mt-1 line-clamp-2 text-[12px] leading-snug text-neutral-400">{s.snippet}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Tarefas deste turno</h2>
        {todos.length === 0 && <p className="text-[13px] text-neutral-500">O agente ainda não abriu uma lista.</p>}
        <ul className="flex flex-col gap-1.5">
          {todos.map((todo) => (
            <li key={todo.content} className="flex items-start gap-2 rounded-xl bg-neutral-900/80 px-2.5 py-2">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TODO_TONE[todo.status]}`} />
              <span className="text-[13px] leading-snug text-neutral-200">{todo.activeForm && todo.status === 'in_progress' ? todo.activeForm : todo.content}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Na fila</h2>
          <span className="font-mono text-[11px] text-neutral-500">{queue.length}</span>
          <Button size="xs" variant="ghost" className="ml-auto" onClick={onTogglePause}>{paused ? 'retomar' : 'pausar'}</Button>
        </div>
        {paused && <p className="mb-2 text-[12px] text-orange-300">Fila pausada. Nada sai até retomar.</p>}
        {queue.length === 0 && <p className="text-[13px] text-neutral-500">Nada esperando para ser enviado.</p>}
        <ul className="flex flex-col gap-2">
          {queue.map((item, index) => {
            const key = itemKey(item);
            const open = editing === key;
            return (
              <li key={key} className="rounded-2xl border border-neutral-800 bg-neutral-900/70 px-3 py-2">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-800 font-mono text-[11px] text-neutral-300">{index + 1}</span>
                  {open ? (
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 text-[13px] text-neutral-100 outline-hidden focus:border-orange-500/50" />
                  ) : (
                    <button type="button" onClick={() => onOpen(item.key)} className="line-clamp-3 min-w-0 flex-1 text-left text-[13px] text-neutral-200">
                      {item.key !== activeId && <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-neutral-500">{sessions.find((s) => s.id === item.key)?.title || 'outro chat'}</span>}
                      {item.text}
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {open ? (
                    <>
                      <Button size="xs" variant="outline" onClick={() => { onEdit(item.sessionKey, item.id, draft); setEditing(null); }}>salvar</Button>
                      <Button size="xs" variant="ghost" onClick={() => setEditing(null)}>cancelar</Button>
                    </>
                  ) : (
                    <>
                      <Button size="xs" variant="ghost" disabled={index === 0} onClick={() => onMove(item.sessionKey, item.id, -1)} aria-label="Subir na fila">subir</Button>
                      <Button size="xs" variant="ghost" disabled={index === queue.length - 1} onClick={() => onMove(item.sessionKey, item.id, 1)} aria-label="Descer na fila">descer</Button>
                      <Button size="xs" variant="outline" onClick={() => onRunNow(item.sessionKey, item.id)}>agora</Button>
                      <Button size="xs" variant="ghost" onClick={() => { setDraft(item.text); setEditing(key); }}>editar</Button>
                      <Button size="xs" variant="ghost" onClick={() => onRemove(item.sessionKey, item.id)} aria-label="Tirar da fila">tirar</Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}
