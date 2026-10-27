import { initials } from '../avatar/initials';
import { Icon } from './Icon';

interface AvatarProps {
  name: string;
  src?: string;
  size?: number;
  className?: string;
}

export function Avatar({ name, src, size = 28, className = '' }: AvatarProps) {
  const init = initials(name);
  return (
    <span
      role="img"
      aria-label={name || 'Avatar'}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.43) }}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-amber-300 to-amber-500 font-semibold text-amber-950 ${className}`}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : init || <Icon name="user" size={Math.round(size * 0.5)} />}
    </span>
  );
}
