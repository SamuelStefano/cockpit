import { sectorRows } from './sectors';
import type { Sim } from './sim';
import { STATIONS_PRACTICE, type SimAgent } from './sim-types';
import type { Floor, FloorAgent, SectorRow } from './types';

function agentLine(s: Sim, a: SimAgent): string {
  if (a.asleep) return 'Out of quota';
  if (a.blockers.size) return 'Needs help';
  if (a.silent) return 'Quiet…';
  if (a.planning) return 'Planning';
  if (a.job) return (a.tool || a.job.task).slice(0, 26);
  const crate = [...s.crates].reverse().find((c) => c.a === a);
  return crate ? `PR: ${crate.status}`.slice(0, 30) : 'Idle';
}

function agentNow(a: SimAgent): string {
  if (a.asleep) return 'Out of quota, asleep';
  if (a.blockers.has('lost')) return 'Waiting: brief never arrived';
  if (a.blockers.has('conflict')) return 'Waiting: same file as a teammate';
  if (a.silent) return 'No output. Something is wrong.';
  if (a.planning) return 'Planning the prompt';
  return a.job ? `${a.tool ? `${a.tool} · ` : ''}${a.job.task}` : 'Nothing assigned';
}

export function practiceAgent(s: Sim, a: SimAgent, i: number): FloorAgent {
  return {
    id: a.id, name: a.name, family: a.family, modelLabel: a.family, wingId: a.wing?.id ?? 'intake', sector: a.planner ? 'intake' : 'build', x: a.x, z: a.z,
    state: a.state, line: agentLine(s, a), ctx: a.ctx, phase: a.phase, cheer: a.cheerUntil > s.t,
    monitor: { kind: 'practice', file: a.job?.file ?? '', key: a.id, progress: a.progress, hasJob: !!a.job, tab: a.tab, term: a.term, log: a.log, now: agentNow(a), next: a.next, preview: 5170 + i },
  };
}

export function practiceFloor(s: Sim): Floor {
  const agents = s.agents.map((a, i) => practiceAgent(s, a, i));
  return {
    agents, wings: s.wings,
    crates: s.crates.map((c) => ({ id: `crate-${c.id}`, title: c.title, x: c.x, y: c.y, z: c.z, band: c.band, flag: c.flag, star: c.star, held: c.held })),
    packets: s.packets.map((p) => {
      const k = Math.min(p.t, 1);
      return { id: p.id, color: p.color, x: p.from.x + (p.to.x - p.from.x) * k, y: p.from.y + (p.to.y - p.from.y) * k + Math.sin(k * Math.PI) * 5, z: p.from.z + (p.to.z - p.from.z) * k };
    }),
    arcs: s.arcs.map(({ a, b }) => ({ from: { x: a.x, z: a.z }, to: { x: b.x, z: b.z } })),
    stations: STATIONS_PRACTICE,
    mountainCount: 70, mountainLabel: '70 SAMPLE CARDS IN REVIEW',
    gateBarsUp: s.barsUp(), machineOk: !s.flags.mcpDown, machineSpin: true, machineLabel: 'SKILLS + MCP',
    racks: [{ name: 'BOX A', disk: s.flags.disk, label: 'BOX A' }, { name: 'BOX B', disk: 0.4, label: 'BOX B' }],
    clockLabel: 'NEXT RUN 2:00', postBoard: s.flags.postColor,
    beltMoving: s.crates.some((c) => !c.flying && !c.done && !c.held),
  };
}

export function practiceSectors(s: Sim, f: Floor): SectorRow[] {
  const live = s.crates.filter((c) => !c.done);
  return sectorRows(f.agents, {
    ship: { busy: live.filter((c) => !c.held).length, stuck: live.filter((c) => c.held).length },
    ops: { stuck: (s.flags.mcpDown ? 1 : 0) + (s.flags.disk > 0.9 ? 1 : 0) },
    archive: { waiting: s.crates.filter((c) => c.done).length },
  });
}
