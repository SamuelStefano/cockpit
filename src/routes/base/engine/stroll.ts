export type StrollPose = 'look' | 'wave' | 'stretch' | 'dance' | 'nap' | 'sip';
export type StrollPhase = 'seated' | 'out' | 'pause' | 'back';
export interface LocalPoint { x: number; z: number }
export interface StrollFrame { phase: StrollPhase; x: number; z: number; heading: number; pose: StrollPose | null }
export interface StrollContext { worldX: number; worldZ: number; may: boolean; restless: boolean }

const CHAIR: LocalPoint = { x: 0, z: 1.75 };
const AISLE_X = 4.5, CLEAR_Z = 3.1, LANE_Z = [3, 6], MAX_WORLD_X = 58, SPEED = 3.2, HURRY = 7;
const POSES: StrollPose[] = ['look', 'wave', 'stretch', 'dance', 'nap', 'sip'];
const span = (r: () => number, a: number, b: number) => a + r() * (b - a);

// Out of the chair, through the aisle between desk columns, along the open lane above the belt. Never through a desk.
export function planPath(worldX: number, worldZ: number, rng: () => number, reach: number): LocalPoint[] {
  const side = worldX > MAX_WORLD_X - 12 ? -1 : worldX < -MAX_WORLD_X + 12 ? 1 : rng() < 0.5 ? -1 : 1;
  const aisle = side * AISLE_X;
  const laneZ = span(rng, LANE_Z[0], LANE_Z[1]) - worldZ;
  const end = Math.max(-MAX_WORLD_X - worldX, Math.min(MAX_WORLD_X - worldX, aisle + side * span(rng, 0, reach)));
  return [{ ...CHAIR }, { x: 0, z: CLEAR_Z }, { x: aisle, z: CLEAR_Z }, { x: aisle, z: laneZ }, { x: end, z: laneZ }];
}

// Idle agents roam often, working ones take a rare short break, and anyone needed runs back to the chair.
export class Stroller {
  private phase: StrollPhase = 'seated';
  private timer: number;
  private path: LocalPoint[] = [];
  private leg = 0;
  private pos: LocalPoint = { ...CHAIR };
  private heading = 0;
  private pose: StrollPose | null = null;
  constructor(private rng: () => number = Math.random) { this.timer = span(this.rng, 1, 12); }

  update(dt: number, c: StrollContext): StrollFrame {
    if (!c.may && (this.phase === 'out' || this.phase === 'pause')) { this.phase = 'back'; this.pose = null; }
    if (this.phase === 'seated') {
      if (c.may && (this.timer -= dt) <= 0) {
        this.path = planPath(c.worldX, c.worldZ, this.rng, c.restless ? 18 : 3);
        this.leg = 1; this.phase = 'out';
      }
    } else if (this.phase === 'pause') {
      if ((this.timer -= dt) <= 0) { this.phase = 'back'; this.pose = null; this.leg = this.path.length - 2; }
    } else this.move(dt * (c.may ? SPEED : HURRY), c);
    return { phase: this.phase, x: this.pos.x, z: this.pos.z, heading: this.heading, pose: this.pose };
  }

  private move(step: number, c: StrollContext) {
    const out = this.phase === 'out';
    if (!out && this.leg >= this.path.length - 1) this.leg = this.path.length - 2;
    const t = this.path[this.leg];
    const dx = t.x - this.pos.x, dz = t.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.001) this.heading = Math.atan2(dx, dz);
    if (d > step) { this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step; return; }
    this.pos = { ...t };
    if (out) {
      if (++this.leg < this.path.length) return;
      this.phase = 'pause';
      this.pose = POSES[Math.floor(this.rng() * POSES.length) % POSES.length];
      this.timer = c.restless ? span(this.rng, 3, 8) : span(this.rng, 1.5, 3);
    } else if (--this.leg < 0) {
      this.phase = 'seated'; this.leg = 0;
      this.timer = c.restless ? span(this.rng, 3, 12) : span(this.rng, 35, 80);
    }
  }
}
