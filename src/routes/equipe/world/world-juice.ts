export const MAX_PARTICLES = 40;

export interface Bob { lift: number; sx: number; sy: number }

// phase advances with distance walked: one hop per step. Squash on landing, stretch at the top.
export function walkBob(phase: number): Bob {
  const t = Math.abs(Math.sin(phase));
  const e = 2 * t - 1;
  return { lift: Math.round(t * 2), sx: 1 - 0.04 * e, sy: 1 + 0.06 * e };
}

export const STEP_PX = 8;
export const stepPhase = (distancePx: number): number => (distancePx / STEP_PX) * Math.PI;

// Two hops over k in 0..1.
export function jumpLift(k: number, height = 9): number {
  if (k <= 0 || k >= 1) return 0;
  return Math.abs(Math.sin(k * Math.PI * 2)) * height;
}

export type ParticleKind = 'dust' | 'spark';

export const FX_DUST = 0;
export const FX_SPARK = 4;
export const FX_SHADOW = 8;
export const FX_SHADOW_SMALL = 9;

// fx.png frame for a particle at life fraction k: four frames per kind.
export function fxFrame(kind: ParticleKind, k: number): number {
  return (kind === 'dust' ? FX_DUST : FX_SPARK) + Math.max(0, Math.min(3, Math.floor(k * 4)));
}

export interface Particle {
  slot: number; kind: ParticleKind; x: number; y: number; vx: number; vy: number; age: number; life: number; alive: boolean;
}

// Fixed pool: a spawn on a full pool recycles the oldest live particle, so the count never passes the cap.
export class ParticleSim {
  readonly particles: Particle[];
  constructor(readonly cap = MAX_PARTICLES) {
    this.particles = Array.from({ length: cap }, (_, slot) => ({ slot, kind: 'dust', x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, alive: false }));
  }

  get live(): number { return this.particles.reduce((n, p) => n + (p.alive ? 1 : 0), 0); }

  spawn(kind: ParticleKind, x: number, y: number, vx: number, vy: number, life: number): Particle {
    let p = this.particles.find((q) => !q.alive);
    if (!p) p = this.particles.reduce((a, b) => (b.age / b.life > a.age / a.life ? b : a));
    Object.assign(p, { kind, x, y, vx, vy, age: 0, life, alive: true });
    return p;
  }

  step(dtMs: number): void {
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.age += dtMs;
      if (p.age >= p.life) { p.alive = false; continue; }
      p.x += (p.vx * dtMs) / 1000;
      p.y += (p.vy * dtMs) / 1000;
      if (p.kind === 'spark') p.vy += (60 * dtMs) / 1000;
    }
  }
}
