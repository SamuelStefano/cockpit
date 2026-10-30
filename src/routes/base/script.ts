import type { JobSpec } from './sim-types';
import type { Sim } from './sim';

const FILES = ['src/live/room.ts', 'src/queue.ts', 'src/ui/Board.tsx', 'server/relay.ts', 'src/player/Activity.tsx'];
const prTitle = (t: string) => (t.toLowerCase().startsWith('fix') ? t : `feat: ${t}`).slice(0, 56);

const teamJobs = (): JobSpec[] => [
  { task: 'Coordinate, room shell', pr: 'feat: team room with chat, queue and live changes', file: 'room/TeamRoom.tsx', dur: 15, to: 0 },
  { task: 'Table button', pr: 'feat: table button opens the conversation', file: 'session/session.ts', dur: 17, to: 1, deployStuck: true },
  { task: 'Persist the queue', pr: 'fix: queue persists pending messages', file: 'session/session.ts', dur: 19, to: 2 },
  { task: 'Live rooms and bots tables', pr: 'feat(db): live rooms and bots', file: 'migrations/0148_live.sql', dur: 17, to: 3, needsGate: true },
  { task: 'Refute the authz finding', pr: 'fix: student profile cannot read host files', file: 'auth/guards.ts', dur: 15, to: 4, lost: true, risky: true },
];

const SAMPLE_A = ['Sample: new lesson kind', 'Sample: scene audit', 'Sample: player polish', 'Sample: content check'];
const SAMPLE_B = ['Sample: persist the queue', 'Sample: relay reconnect', 'Sample: canvas filters', 'Sample: ops cleanup', 'Sample: usage panel'];

function wingJobs(s: Sim, titles: string[], n: number): JobSpec[] {
  return Array.from({ length: n }, (_, i) => {
    const t = titles[i % titles.length];
    return { task: t, pr: prTitle(t), file: s.pick(FILES), dur: 14 + s.rnd() * 10, to: i };
  });
}

export function composedJobs(s: Sim, text: string, n: number): JobSpec[] {
  return Array.from({ length: n }, (_, i) => ({
    task: `${text} · part ${i + 1}`, pr: prTitle(`${text}${n > 1 ? ` (${i + 1}/${n})` : ''}`),
    file: s.pick(['src/app.ts', 'src/ui/Main.tsx', 'server/api.ts']), dur: 12 + s.rnd() * 8, to: i,
  }));
}

export interface ScriptEvent { t: number; fired?: boolean; f: (s: Sim) => void }

export const script = (): ScriptEvent[] => [
  { t: 1.5, f: (s) => s.newPrompt('Build the team room, end to end', 'team', teamJobs()) },
  { t: 15, f: (s) => { const w = s.wingAgents('team'), a = w[2], b = w[1]; b.blockers.add('conflict'); s.arcs.push({ a, b }); s.raise('conflict', { a, b, file: 'session.ts', id: 'team' }, a, a.id); } },
  { t: 18, f: (s) => s.newPrompt(SAMPLE_A[0], 'sample-a', wingJobs(s, SAMPLE_A, 4), 4) },
  { t: 22, f: (s) => { const a = s.wingAgents('team')[3]; a.silent = true; s.log(a, 'No output since this moment'); s.silentChecks.push({ a, t: s.t + 7 }); } },
  { t: 34, f: (s) => { const a = s.planner; s.flags.quotaOut = true; a.blockers.add('quota'); a.asleep = true; s.raise('quota', { a }, a, a.id); s.fx.push({ kind: 'shake', v: 0.3 }); } },
  { t: 40, f: (s) => { s.flags.postDeadline = s.t + 45; s.raise('post', { deadline: s.t + 45, id: 'p1' }, { x: -63, z: 5 }); } },
  { t: 46, f: (s) => s.newPrompt(SAMPLE_B[0], 'sample-b', wingJobs(s, SAMPLE_B, 5), 4) },
  { t: 58, f: (s) => { s.flags.mcpDown = true; s.fx.push({ kind: 'shake', v: 0.25 }, { kind: 'burst', x: 53, y: 3, z: -10, color: 0xff8a4d, n: 16, up: 8 }); s.raise('mcp', { id: 'm1' }, { x: 53, z: -10 }); } },
  { t: 66, f: (s) => s.raise('disk', { id: 'd1' }, { x: 50, z: -1 }) },
];
