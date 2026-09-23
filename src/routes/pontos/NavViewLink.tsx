import { Icon, tokens, type IconName } from '../../components/primitives';

// A non-epic destination of the navigator (invoices, the agent's ledger).
export function NavViewLink({ icon, label, count, active, onClick }: { icon: IconName; label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? 'true' : undefined}
      className={`flex h-8 items-center gap-2 rounded-md px-2.5 text-[12.5px] transition ${tokens.focusRing} ${
        active ? 'bg-orange-500/10 text-neutral-50' : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100'}`}>
      <Icon name={icon} size={13} className={active ? 'text-orange-400' : 'text-neutral-500'} />
      <span className="flex-1 text-left">{label}</span>
      <span className="font-mono text-[11px] tabular-nums text-neutral-500">{count}</span>
    </button>
  );
}
