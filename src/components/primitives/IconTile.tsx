import { Icon, type IconName } from './Icon';

export type TileTone = 'orange' | 'sky' | 'violet' | 'emerald' | 'amber' | 'rose' | 'neutral';

const tones: Record<TileTone, string> = {
  orange: 'bg-orange-500/20 text-orange-300',
  sky: 'bg-sky-500/20 text-sky-300',
  violet: 'bg-violet-500/20 text-violet-300',
  emerald: 'bg-emerald-500/20 text-emerald-300',
  amber: 'bg-amber-500/20 text-amber-300',
  rose: 'bg-rose-500/20 text-rose-300',
  neutral: 'bg-neutral-800 text-neutral-300',
};

const sizes = { sm: { box: 'h-8 w-8 rounded-lg', icon: 16 }, md: { box: 'h-10 w-10 rounded-xl', icon: 20 }, lg: { box: 'h-14 w-14 rounded-2xl', icon: 28 } } as const;

const ROTATION: TileTone[] = ['violet', 'sky', 'emerald', 'amber', 'rose', 'orange'];

// Stable hue per key, so the same item keeps the same colour between renders.
export function toneFor(key: string): TileTone {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return ROTATION[h % ROTATION.length];
}

interface IconTileProps {
  icon?: IconName;
  tone?: TileTone;
  size?: keyof typeof sizes;
  children?: React.ReactNode;
  className?: string;
}

export function IconTile({ icon, tone = 'orange', size = 'md', children, className = '' }: IconTileProps) {
  const s = sizes[size];
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center font-display font-bold ${s.box} ${tones[tone]} ${className}`}>
      {icon ? <Icon name={icon} size={s.icon} /> : children}
    </span>
  );
}
