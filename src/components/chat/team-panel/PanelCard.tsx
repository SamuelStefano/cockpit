import type { TeamMascot } from '../../../../shared/protocol';
import type { TeamBotStatus } from '../../../../shared/team-state';

const DOT: Record<TeamBotStatus, string> = { working: 'bg-green-500', waiting: 'bg-yellow-500', idle: 'bg-neutral-500' };
export const HIDDEN = '••••';

interface PanelCardProps {
  name: string;
  mascot?: TeamMascot;
  status: TeamBotStatus;
  line: string | null;
  ageHours?: number | null;
  need?: boolean;
  onOpen: () => void;
}

export function PanelCard({ name, mascot, status, line, ageHours, need = false, onOpen }: PanelCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full min-w-0 cursor-pointer rounded-xl border px-2.5 py-2 text-left hover:border-orange-500/50 ${need ? 'border-red-500/40 bg-red-500/5' : 'border-neutral-800 bg-neutral-900'}`}
    >
      <span className="flex items-center gap-2">
        <span className="relative h-5 w-5 shrink-0 rounded-md" style={{ background: mascot?.color ?? '#737373' }}>
          <span aria-label={status} className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-neutral-900 ${DOT[status]}`} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-neutral-100">{name}</span>
        {need && ageHours != null && <span className="shrink-0 rounded bg-red-500/15 px-1.5 text-[11px] text-red-400">há {ageHours} h</span>}
      </span>
      <span className={`mt-1.5 line-clamp-2 block text-[12px] leading-snug ${line === null ? 'tracking-widest text-neutral-600' : 'text-neutral-400'}`}>{line === null ? HIDDEN : line}</span>
    </button>
  );
}
