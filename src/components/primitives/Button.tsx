import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

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
  // Primário como jóia: gradiente quente + highlight interno no topo (btn-jewel).
  primary: 'btn-jewel bg-gradient-to-b from-orange-500 to-orange-600 text-neutral-950 hover:from-orange-400 hover:to-orange-500',
  secondary: 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700 hairline',
  outline: 'border border-neutral-800 bg-neutral-900 text-neutral-200 hover:border-orange-500/40 hover:bg-orange-500/[0.06] hover:text-orange-300',
  ghost: 'bg-transparent text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100',
  danger: 'bg-neutral-800 text-neutral-200 hover:bg-red-500/20 hover:text-red-400 hairline',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-7 gap-1.5 px-2.5 text-[12px]',
  md: 'h-8 gap-2 px-3 text-[13px]',
};

const squareSizes: Record<ButtonSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
};

const iconSize: Record<ButtonSize, number> = { sm: 13, md: 15 };

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
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-medium leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 disabled:opacity-50 disabled:pointer-events-none ${ripple ? 'relative overflow-hidden' : ''} ${variants[variant]} ${square ? squareSizes[size] : sizes[size]} ${className}`}
      {...rest}
    >
      {glyph && !iconRight && glyph}
      {children}
      {glyph && iconRight && glyph}
      {inks.map((k) => (
        <span key={k.id} className="ripple-ink" style={{ left: k.x - k.d / 2, top: k.y - k.d / 2, width: k.d, height: k.d }} />
      ))}
    </button>
  );
}
