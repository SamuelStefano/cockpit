import type { RefObject } from 'react';
import { Icon } from '../../components/primitives';
import { comboLabel } from '../../lib/platform';

interface Props { value: string; onChange: (v: string) => void; inputRef: RefObject<HTMLInputElement | null> }

export function SkillsSearch({ value, onChange, inputRef }: Props) {
  return (
    <div className="flex w-full items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 focus-within:border-neutral-700 focus-within:ring-2 focus-within:ring-orange-500/15 sm:w-80">
      <Icon name="search" size={14} className="shrink-0 text-neutral-500" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar skills e packs…"
        aria-label="Buscar skills e packs"
        className="w-full bg-transparent text-[12.5px] text-neutral-200 placeholder-neutral-600 outline-hidden"
      />
      <kbd className="hidden shrink-0 rounded-sm border border-neutral-700 bg-neutral-950 px-1 py-px font-mono text-[9px] text-neutral-500 sm:block">{comboLabel(['⌘', '/'])}</kbd>
    </div>
  );
}
