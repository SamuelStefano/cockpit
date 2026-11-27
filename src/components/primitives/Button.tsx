import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dangerSolid';
// xs = inline action inside a dense row (table header, list line).
type ButtonSize = 'xs' | 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: boolean;
  loading?: boolean;
  square?: boolean;
  ripple?: boolean;
}

interface Ink { id: number; x: number; y: number; d: number }

const variants: Record<ButtonVariant, string> = {
  primary: 'border border-white/12 bg-linear-to-b from-(--accent) to-(--accent-600) font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_14px_rgba(249,115,22,0.22)] hover:brightness-110',
  secondary: 'border border-(--border-strong) bg-neutral-800 font-medium text-(--text) hover:border-neutral-600',
  outline: 'font-medium border border-neutral-800 bg-neutral-900 text-neutral-200 hover:border-orange-500/40 hover:bg-orange-500/6 hover:text-orange-300',
  ghost: 'font-medium bg-transparent text-(--text-weak) hover:bg-neutral-800 hover:text-(--text)',
  danger: 'border border-red-500/40 bg-red-500/12 font-medium text-red-300 hover:bg-red-500/20',
  // Destrutivo já CONFIRMADO (CTA de modal): peso visual de primário.
  dangerSolid: 'border border-white/12 bg-red-500 font-medium text-white hover:bg-red-400',
};

const sizes: Record<ButtonSize, string> = {
  xs: 'h-[30px] gap-1.5 rounded-lg px-2.5 text-[12px]',
  sm: 'h-9 gap-2 rounded-[10px] px-3.5 text-[13px]',
  md: 'h-11 gap-2 rounded-xl px-[18px] text-[14px]',
};

const squareSizes: Record<ButtonSize, string> = {
  xs: 'h-[30px] w-[30px] rounded-lg',
  sm: 'h-9 w-9 rounded-[10px]',
  md: 'h-11 w-11 rounded-xl',
};

const iconSize: Record<ButtonSize, number> = { xs: 13, sm: 15, md: 18 };

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight = false,
  loading = false,
  square = false,
  ripple = false,
  disabled,
  className = '',
  onPointerDown,
  ...rest
}: ButtonProps) {
  const [inks, setInks] = useState<Ink[]>([]);
  const glyph = loading ? (
    <Icon name="rotate" size={iconSize[size]} className="spin" />
  ) : icon ? (
    <Icon name={icon} size={iconSize[size]} />
  ) : null;
  const spawnInk = (e: React.PointerEvent<HTMLButtonElement>) => {
    onPointerDown?.(e);
    if (!ripple || disabled || loading) return;
    const r = e.currentTarget.getBoundingClientRect();
    const id = Date.now() + Math.random();
    setInks((p) => [...p, { id, x: e.clientX - r.left, y: e.clientY - r.top, d: Math.max(r.width, r.height) }]);
    window.setTimeout(() => setInks((p) => p.filter((k) => k.id !== id)), 600);
  };
  return (
    <button
      disabled={disabled || loading}
      onPointerDown={spawnInk}
      className={`inline-flex max-w-full shrink-0 items-center justify-center whitespace-nowrap leading-none transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40 disabled:opacity-50 disabled:pointer-events-none ${ripple ? 'relative overflow-hidden' : ''} ${variants[variant]} ${square ? squareSizes[size] : sizes[size]} ${className}`}
      {...rest}
    >
      {glyph && !iconRight && glyph}
      {/* Altura é fixa (leading-none): sem truncar, rótulo longo vaza pra fora da pílula.
          Glifo vem pela prop `icon`, nunca dentro do rótulo: o preflight deixa `svg`
          como bloco e um ícone aqui dentro quebraria o texto pra segunda linha. */}
      {children != null && children !== false && <span className="min-w-0 truncate py-[0.2em] leading-[1.3]">{children}</span>}
      {glyph && iconRight && glyph}
      {inks.map((k) => (
        <span key={k.id} className="ripple-ink" style={{ left: k.x - k.d / 2, top: k.y - k.d / 2, width: k.d, height: k.d }} />
      ))}
    </button>
  );
}
