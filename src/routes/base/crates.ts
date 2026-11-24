import { BELT, COLORS, STATIONS_PRACTICE, type Crate, type Job, type SimAgent } from './sim-types';
import type { Sim } from './sim';

const SHELF_X = 58;

export function spawnCrate(s: Sim, a: SimAgent, job: Job): Crate {
  const c: Crate = { id: s.nextId(), a, job, title: job.pr, file: job.file, x: a.x, y: 2, z: a.z + 0.3, stage: -1, wait: 0, flying: 0.0001, status: 'to the belt', trail: [{ t: s.t, what: `${a.name} finished the code` }] };
  s.crates.push(c);
  job.crate = c;
  job.stage = 'tests';
  s.log(a, `PR opened: ${job.pr}`);
  s.feed(`PR opened: ${job.pr}`, 'info', a);
  return c;
}

function fly(c: Crate, dt: number) {
  c.flying += dt / 1.8;
  const k = Math.min(c.flying, 1);
  c.x = c.a.x + (BELT.x0 - c.a.x) * k;
  c.z = c.a.z + 0.3 + (BELT.z - c.a.z - 0.3) * k;
  c.y = 2 + (0.75 - 2) * k + Math.sin(k * Math.PI) * 5;
  if (k >= 1) { c.flying = 0; c.status = 'on the belt'; c.x = BELT.x0; }
}

function atStation(s: Sim, c: Crate, dt: number): boolean {
  const here = STATIONS_PRACTICE[c.stage], pos = { x: here.x, z: BELT.z };
  if (here.id === 'review' && (s.flags.quotaOut || s.t < s.flags.quotaResetAt)) { c.status = 'review line stopped: no quota'; return true; }
  if (here.id === 'review' && c.job.risky && !c.tainted) { c.held = true; c.status = 'held: review finding'; s.raise('finding', { crate: c, id: String(c.id) }, pos); return true; }
  if (here.id === 'deployed' && c.job.deployStuck && !c.deployAsked) { c.deployAsked = true; c.held = true; c.status = 'merged, NOT deployed'; s.raise('deploy', { crate: c, id: String(c.id) }, pos); return true; }
  if (here.id === 'deployed' && c.tainted && !c.broke) {
    c.broke = true; c.status = 'deployed, then broke';
    s.fx.push({ kind: 'shake', v: 0.8 }, { kind: 'burst', x: here.x, y: 2, z: BELT.z, color: COLORS.red, n: 22, up: 9 });
    c.job.risky = false;
    s.raise('regression', { title: c.title, id: String(c.id) }, pos);
    s.sendBack(c, 'Rolled back after regression');
    return true;
  }
  if (here.id === 'review') s.flags.reviewNow = s.t + 0.3;
  c.wait -= dt;
  if (c.wait <= 0) c.trail.push({ t: s.t, what: `${here.label} passed` });
  return true;
}

function arrive(s: Sim, c: Crate, next: (typeof STATIONS_PRACTICE)[number]) {
  c.x = next.x; c.stage++; c.wait = next.wait; c.status = next.label.toLowerCase(); c.job.stage = next.id;
  if (next.id === 'review') s.fx.push({ kind: 'walk', agentId: s.planner.id, to: { x: next.x, z: BELT.z - 3 } });
  if (next.id === 'merged') c.band = true;
  if (next.id === 'deployed') c.flag = true;
  if (next.id === 'verified') {
    const n = s.crates.filter((o) => o.done).length;
    c.star = true; c.done = true; c.status = 'verified in production'; c.trail.push({ t: s.t, what: 'Verified in production' });
    c.x = SHELF_X + (n % 2 ? 0.7 : -0.7); c.z = 5 + (n % 8) * 1.3; c.y = 0.5 + Math.floor(n / 8) * 1.3;
    s.xp += 25;
    s.fx.push({ kind: 'burst', x: next.x, y: 2, z: BELT.z, color: COLORS.gold, n: 18, up: 9 }, { kind: 'chord', fs: [660, 830, 990] }, { kind: 'pop', agentId: c.a.id, k: 1.6 });
    c.a.cheerUntil = s.t + 2.4;
    s.feed(`Verified: ${c.title}`, 'good', { x: next.x, z: BELT.z });
  } else s.fx.push({ kind: 'beep', f: 300 + c.stage * 60, d: 0.06, wave: 'square', v: 0.05 });
  if (next.id === 'gate' && !c.job.needsGate) c.wait = 0.1;
}

export function stepCrate(s: Sim, c: Crate, dt: number) {
  if (c.flying) { fly(c, dt); return; }
  if (c.held) return;
  if (c.wait > 0) { atStation(s, c, dt); return; }
  const next = STATIONS_PRACTICE[c.stage + 1];
  if (!next) return;
  if (next.id === 'gate' && c.job.needsGate && !c.cleared && c.x >= next.x - 1.6) {
    c.status = 'waiting at the gate';
    s.raise('migration', { crate: c, id: String(c.id) }, { x: next.x, z: BELT.z });
    return;
  }
  if (s.crates.some((o) => o !== c && !o.flying && !o.done && o.x > c.x && o.x - c.x < 1.5)) return;
  c.x += dt * 4.5; c.y = 0.75; c.z = BELT.z;
  if (c.x >= next.x) arrive(s, c, next);
}
