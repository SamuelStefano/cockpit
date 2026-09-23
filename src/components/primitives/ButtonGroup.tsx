import type { ReactNode } from 'react';

interface ButtonGroupProps {
  label?: string;
  children: ReactNode;
  className?: string;
}

// Related actions under one small caption ("agente": criar tudo · só esta
// delivery · selecionadas), so a cluster of buttons reads as one decision.
export function ButtonGroup({ label, children, className = '' }: ButtonGroupProps) {
  return (
    <div role="group" aria-label={label} className={`inline-flex items-center gap-0.5 rounded-lg border border-neutral-800 bg-neutral-900/60 p-0.5 ${className}`}>
      {label && <span className="px-1.5 font-mono text-[10px] lowercase tracking-wide text-neutral-500">{label}</span>}
      {children}
    </div>
  );
}
