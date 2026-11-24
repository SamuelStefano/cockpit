import { useState } from 'react';
import { Icon, Input, tokens } from '../primitives';

export function PlannerAdd({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const close = () => { setOpen(false); setTitle(''); };
  if (!open) {
    return (
      <button
        type="button" onClick={() => setOpen(true)}
        className={`flex h-8 w-full shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12px] text-neutral-600 transition-colors hover:bg-neutral-800/50 hover:text-neutral-300 pointer-coarse:h-11 ${tokens.focusRing}`}
      >
        <Icon name="plus" size={13} /> Nova task
      </button>
    );
  }
  return (
    <Input
      autoFocus size="sm" value={title} maxLength={140} placeholder="Título e Enter" aria-label="Título da nova task"
      onChange={(e) => setTitle(e.target.value)} onBlur={close}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
        if (e.key === 'Enter' && title.trim()) { onAdd(title); setTitle(''); }
      }}
    />
  );
}
