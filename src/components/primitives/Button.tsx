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
  // Chunky primary: flat fill + darker bottom lip that squashes on press (btn-chunk).
  primary: 'btn-chunk font-display font-bold tracking-wide bg-orange-500 text-neutral-950 hover:bg-orange-400',
  secondary: 'font-medium bg-neutral-800 text-neutral-200 hover:bg-neutral-700 hairline',
  outline: 'font-medium border border-neutral-800 bg-neutral-900 text-neutral-200 hover:border-orange-500/40 hover:bg-orange-500/6 hover:text-orange-300',
  ghost: 'font-medium bg-transparent text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100',
  danger: 'font-medium bg-neutral-800 text-neutral-200 hover:bg-red-500/20 hover:text-red-400 hairline',
  // Destrutivo já CONFIRMADO (CTA de modal): peso visual de primário. O `danger`
  // discreto some entre os outros botões quando é a ação principal do diálogo.
  dangerSolid: 'btn-chunk btn-chunk-red font-display font-bold tracking-wide bg-red-500 text-white hover:bg-red-400',
};

const sizes: Record<ButtonSize, string> = {
  xs: 'h-7 gap-1 px-2.5 text-[13px]',
  sm: 'h-9 gap-1.5 px-3.5 text-[14px]',
  md: 'h-11 gap-2 px-5 text-[16px]',
};

const squareSizes: Record<ButtonSize, string> = {
  xs: 'h-7 w-7',
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
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
      className={`inline-flex max-w-full shrink-0 items-center justify-center whitespace-nowrap rounded-xl leading-none transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40 disabled:opacity-50 disabled:pointer-events-none ${ripple ? 'relative overflow-hidden' : ''} ${variants[variant]} ${square ? squareSizes[size] : sizes[size]} ${className}`}
      {...rest}
    >
      {glyph && !iconRight && glyph}
      {/* Altura é fixa (leading-none): sem truncar, rótulo longo vaza pra fora da pílula.
          Glifo vem pela prop `icon`, nunca dentro do rótulo: o preflight deixa `svg`
          como bloco e um ícone aqui dentro quebraria o texto pra segunda linha. */}
      {children != null && children !== false && <span className="min-w-0 truncate">{children}</span>}
      {glyph && iconRight && glyph}
      {inks.map((k) => (
        <span key={k.id} className="ripple-ink" style={{ left: k.x - k.d / 2, top: k.y - k.d / 2, width: k.d, height: k.d }} />
      ))}
    </button>
  );
}
