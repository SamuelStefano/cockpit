import type { ReactNode } from 'react';
import { Badge, Button } from '../../components/primitives';
import type { ProviderRowModel } from '../../cockpit/onboarding-rows';

interface ProviderRowProps {
  row: ProviderRowModel;
  action?: ReactNode;
  detail?: ReactNode;
}

export function ProviderRow({ row, action, detail }: ProviderRowProps) {
  const { logo, state } = row;
  const soon = state === 'soon';
  return (
    <li className={`hairline flex flex-wrap items-center gap-3.5 rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3.5 ${soon ? 'opacity-60' : ''}`}>
      <span
        aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[13px] font-bold"
        style={{ background: logo.bg, color: logo.fg }}
      >
        {logo.letter}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-neutral-100">{row.name}</div>
        <div className={`mt-px text-[12px] ${state === 'ready' ? 'text-green-300' : state === 'error' ? 'text-red-400' : 'text-neutral-500'}`}>{row.detail}</div>
      </div>
      <div className="ml-auto shrink-0">
        {state === 'ready' && <Badge tone="green" dot>pronto</Badge>}
        {state === 'soon' && <Badge tone="neutral">em breve</Badge>}
        {state === 'checking' && <Button size="sm" variant="ghost" disabled loading>Verificando</Button>}
        {(state === 'install' || state === 'error' || state === 'waiting-login') && action}
      </div>
      {state === 'waiting-login' && detail && (
        <div className="flex w-full flex-col gap-2.5 border-t border-neutral-800 pt-3">{detail}</div>
      )}
    </li>
  );
}
