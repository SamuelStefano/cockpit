import { modeChipOf } from './composer-mode';
import type { PermMode } from '../../../shared/protocol';

const chip = 'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none';

// Only non-default state shows here: the box stays plain until the user is in a
// mode or a permission level they should not forget about.
export function ComposerStatusChips({ mode, bypass }: { mode: PermMode; bypass: boolean }) {
  const m = modeChipOf(mode);
  if (!m && !bypass) return null;
  return (
    <>
      {m && <span title={m.hint} className={`${chip} ${m.tone}`}>{m.label}</span>}
      {bypass && (
        <span title="Bypass ligado: o agente roda qualquer comando sem aprovação" className={`${chip} bg-red-500/15 text-red-300`}>
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> bypass
        </span>
      )}
    </>
  );
}
