import type { ReactNode } from 'react';

interface ListRowProps {
  label: ReactNode;
  hint?: ReactNode;
  leading?: ReactNode;
  value?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  // Whole-row toggle: the row itself is the switch (a 36x20 track is a poor tap target).
  switchChecked?: boolean;
  className?: string;
}

export function ListRow({ label, hint, leading, value, trailing, onClick, switchChecked, className = '' }: ListRowProps) {
  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] text-neutral-100">{label}</span>
        {hint && <small className="mt-px block text-[12px] text-neutral-500">{hint}</small>}
      </span>
      {value && <span className="text-[13px] text-neutral-400">{value}</span>}
      {trailing}
    </>
  );
  const cls = `flex min-h-13 w-full items-center gap-3 border-t border-neutral-800 px-4 py-2.5 text-left first:border-t-0 ${className}`;
  if (onClick) return <button type="button" onClick={onClick} {...(switchChecked !== undefined ? { role: 'switch', 'aria-checked': switchChecked } : {})} className={`${cls} transition-colors hover:bg-neutral-800/60`}>{body}</button>;
  return <div className={cls}>{body}</div>;
}
