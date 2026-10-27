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
  focusRing: 'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40',
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
  // Halo externo do selo da marca (logo das telas de entrada).
  accentGlow: 'shadow-[0_0_12px_-1px_rgba(249,115,22,0.55)]',
  // Aro interno de 1px na cor do estado: marca "ligado" em toggle/chip sem somar
  // 1px de borda ao layout (border mudaria a caixa e faria o item pular ao alternar).
  insetRing: {
    accent: 'shadow-[inset_0_0_0_1px_rgba(249,115,22,0.4)]',
    warn: 'shadow-[inset_0_0_0_1px_rgba(245,158,11,0.4)]',
    err: 'shadow-[inset_0_0_0_1px_rgba(239,68,68,0.4)]',
  },
  // Realce de acento (botão primário/destaques): gradiente quente + brilho de jóia.
  accentGradient: 'bg-linear-to-b from-orange-500 to-orange-600',
  // Alvo de toque de 40px (brief do design-kit) sem inchar o ícone: a área sensível
  // é um pseudo-elemento centrado, só no dedo. Não serve pra botão colado em outro
  // a menos de 40px de centro a centro — ali a área roubaria o toque do vizinho.
  touchTarget: "relative pointer-coarse:before:absolute pointer-coarse:before:left-1/2 pointer-coarse:before:top-1/2 pointer-coarse:before:h-10 pointer-coarse:before:w-10 pointer-coarse:before:-translate-x-1/2 pointer-coarse:before:-translate-y-1/2 pointer-coarse:before:content-['']",
  // Mesma meta de 40px quando o vizinho está a menos de 40px: aqui a caixa REAL
  // cresce (ícone centrado, sem fundo novo), porque a área invisível do
  // `touchTarget` roubaria o toque do botão ao lado.
  touchBox: 'pointer-coarse:flex pointer-coarse:h-10 pointer-coarse:w-10 pointer-coarse:items-center pointer-coarse:justify-center',
} as const;

export type ToneColor = keyof typeof tokens.color;
