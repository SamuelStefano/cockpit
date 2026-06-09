export const tokens = {
  color: {
    bg: 'var(--bg)',
    bgDeep: 'var(--bg-deep)',
    termBg: 'var(--term-bg)',
    border: 'var(--border)',
    borderSoft: 'var(--border-soft)',
    accent: 'var(--accent)',
    ok: 'var(--ok)',
    warn: 'var(--warn)',
    err: 'var(--err)',
  },
  radius: {
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-full',
  },
  focusRing: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40',
  text: {
    primary: 'text-neutral-100',
    secondary: 'text-neutral-300',
    muted: 'text-neutral-500',
    accent: 'text-orange-400',
  },
  surface: {
    base: 'bg-neutral-900/60 border border-neutral-800',
    raised: 'bg-neutral-950 border border-neutral-700',
  },
} as const;

export type ToneColor = keyof typeof tokens.color;
