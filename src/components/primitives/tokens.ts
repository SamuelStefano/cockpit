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
    // Card em repouso: hairline (luz no topo) dá profundidade sem sombra pesada.
    base: 'bg-neutral-900/60 border border-neutral-800 hairline',
    // Elevado (popover/modal/menu): escala de elevação com highlight interno.
    raised: 'bg-neutral-950 border border-neutral-700 elev-2',
    // Vidro: superfície translúcida com blur — pra sobrepor o glow do fundo.
    glass: 'bg-neutral-900/70 border border-neutral-800 backdrop-blur-md hairline',
  },
  // Escala de elevação reusável (classes definidas no index.css).
  elevation: { sm: 'elev-1', md: 'elev-2' },
  // Item ativo/selecionado: aro + halo quente discretos (acento vira jóia).
  activeGlow: 'glow-active',
  // Realce de acento (botão primário/destaques): gradiente quente + brilho de jóia.
  accentGradient: 'bg-gradient-to-b from-orange-500 to-orange-600',
} as const;

export type ToneColor = keyof typeof tokens.color;
