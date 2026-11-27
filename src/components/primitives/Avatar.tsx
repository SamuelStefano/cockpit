import type { ReactNode } from 'react';
import { initials } from '../avatar/initials';
import { Icon } from './Icon';

export type AvatarTone = 'orange' | 'blue' | 'pink' | 'green' | 'yellow' | 'purple' | 'cyan';
export type AvatarStatus = 'ok' | 'warn' | 'err' | 'info' | 'idle';

interface AvatarProps {
  name: string;
  src?: string;
  size?: number;
  tone?: AvatarTone;
  // Arbitrary data color (a bot mascot hex); wins over `tone`.
  color?: string;
  status?: AvatarStatus;
  // Drawn instead of the initials (an agent mascot); the tone becomes a soft tint behind it.
  glyph?: ReactNode;
  className?: string;
}

const toneBg: Record<AvatarTone, string> = {
  orange: 'bg-[#f97316]',
  blue: 'bg-[#3b82f6]',
  pink: 'bg-[#ec4899]',
  green: 'bg-[#22c55e]',
  yellow: 'bg-[#eab308]',
  purple: 'bg-[#a855f7]',
  cyan: 'bg-[#06b6d4]',
};

const toneTint: Record<AvatarTone, string> = {
  orange: 'bg-[#f97316]/20',
  blue: 'bg-[#3b82f6]/20',
  pink: 'bg-[#ec4899]/20',
  green: 'bg-[#22c55e]/20',
  yellow: 'bg-[#eab308]/20',
  purple: 'bg-[#a855f7]/20',
  cyan: 'bg-[#06b6d4]/20',
};

const statusBg: Record<AvatarStatus, string> = {
  ok: 'bg-(--ok)',
  warn: 'bg-(--warn)',
  err: 'bg-(--err)',
  info: 'bg-(--info)',
  idle: 'bg-neutral-600',
};

export function Avatar({ name, src, size = 28, tone, color, status, glyph, className = '' }: AvatarProps) {
  const init = initials(name);
  const look = tone || color
    ? `rounded-[30%] ${color ? '' : glyph ? toneTint[tone!] : toneBg[tone!]} text-neutral-950`
    : 'rounded-full bg-linear-to-br from-amber-300 to-amber-500 text-amber-950';
  const dot = Math.max(8, Math.round(size * 0.32));
  return (
    <span
      role="img"
      aria-label={name || 'Avatar'}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.43), ...(color ? { background: color } : {}) }}
      className={`relative inline-flex shrink-0 items-center justify-center font-semibold ${look} ${className}`}
    >
      <span className={`flex h-full w-full items-center justify-center overflow-hidden ${tone || color ? 'rounded-[30%]' : 'rounded-full'}`}>
        {glyph ?? (src ? <img src={src} alt="" className="h-full w-full object-cover" /> : init || <Icon name="user" size={Math.round(size * 0.5)} />)}
      </span>
      {status && (
        <span
          data-status={status}
          style={{ width: dot, height: dot }}
          className={`absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-(--term-bg) ${statusBg[status]}`}
        />
      )}
    </span>
  );
}
