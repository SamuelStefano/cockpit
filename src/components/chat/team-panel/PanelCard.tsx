import type { ReactNode } from 'react';

export function PanelCard({ title, meta, onOpen, children }: { title: string; meta?: string; onOpen?: () => void; children?: ReactNode }) {
  return (
    <button
      type="button"
      disabled={!onOpen}
      onClick={onOpen}
      className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-left text-neutral-200 enabled:cursor-pointer enabled:hover:border-orange-500/50 disabled:cursor-default"
    >
      <span className="block truncate">{title}</span>
      {meta && <span className="mt-0.5 block truncate text-[12px] text-neutral-500">{meta}</span>}
      {children}
    </button>
  );
}
