const CHIP_ACTIVE: Record<string, string> = {
  orange: 'border-orange-500/40 bg-orange-500/15 text-orange-300',
  green: 'border-green-500/40 bg-green-500/15 text-green-300',
  yellow: 'border-yellow-500/40 bg-yellow-500/15 text-yellow-300',
  red: 'border-red-500/40 bg-red-500/15 text-red-300',
  neutral: 'border-neutral-600 bg-neutral-800 text-neutral-200',
};

interface ContextChipProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone: string;
}

export function ContextChip({ active, onClick, label, count, tone }: ContextChipProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition
        ${active ? (CHIP_ACTIVE[tone] ?? CHIP_ACTIVE.neutral) : 'border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300'}`}
    >
      {label} <span className="tabular-nums opacity-60">{count}</span>
    </button>
  );
}
