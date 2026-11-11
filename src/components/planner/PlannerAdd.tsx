import { useState } from 'react';
import { Icon, Input } from '../primitives';

export function PlannerAdd({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const close = () => { setOpen(false); setTitle(''); };
  if (!open) {
    return (
      <button
        type="button" onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center gap-1.5 rounded-lg px-2 text-[13px] text-neutral-500 transition hover:bg-neutral-800/60 hover:text-neutral-200 pointer-coarse:h-11"
      >
        <Icon name="plus" size={14} /> Nova task
      </button>
    );
  }
  return (
    <Input
      autoFocus size="sm" value={title} maxLength={140} placeholder="Título e Enter" aria-label="Título da nova task"
      onChange={(e) => setTitle(e.target.value)} onBlur={close}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.stopPropagation(); close(); }
        if (e.key === 'Enter' && title.trim()) { onAdd(title); setTitle(''); }
      }}
    />
  );
}
