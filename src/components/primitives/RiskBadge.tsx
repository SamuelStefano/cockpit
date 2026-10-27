export type Risk = 'read' | 'write' | 'net';

const RISKS: Record<Risk, { label: string; cls: string }> = {
  read: { label: 'lê', cls: 'text-green-300' },
  write: { label: 'escreve', cls: 'text-amber-300' },
  net: { label: 'rede', cls: 'text-blue-300' },
};

export function RiskBadge({ risk, className = '' }: { risk: Risk; className?: string }) {
  const r = RISKS[risk];
  return (
    <span className={`inline-flex h-5 items-center gap-1 rounded-md border border-neutral-800 bg-neutral-800 px-1.75 text-[11px] font-medium ${r.cls} ${className}`}>
      {r.label}
    </span>
  );
}
