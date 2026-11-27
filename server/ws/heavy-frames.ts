import { randomBytes } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';
import { getTeam } from '../team';
import { readExecutorConfig, probeArgv, spawnArgv } from '../heavy-executor';
import { cancelHeavyJob, heavySnapshot, refreshExecutorState, startHeavyJob, type HeavyDeps } from '../heavy-jobs';
import { broadcast, send } from './broadcast';

export function liveHeavyDeps(): HeavyDeps {
  return {
    config: readExecutorConfig,
    probe: probeArgv,
    spawn: spawnArgv,
    getTeam,
    publish: (executor, jobs) => broadcast({ t: 'heavy', executor, jobs }),
    setTimer: (fn, ms) => {
      const t = setTimeout(fn, ms);
      t.unref();
      return () => clearTimeout(t);
    },
    now: Date.now,
    newId: () => `h${Date.now().toString(36)}${randomBytes(2).toString('hex')}`,
  };
}

export async function sendHeavy(ws: WebSocket, deps: HeavyDeps = liveHeavyDeps()): Promise<void> {
  await refreshExecutorState(deps).catch(() => {});
  const s = await heavySnapshot(deps);
  send(ws, { t: 'heavy', executor: s.executor, jobs: s.jobs });
}

export async function runHeavyFrame(ws: WebSocket, msg: Extract<ClientMsg, { t: 'heavy-run' }>, deps: HeavyDeps = liveHeavyDeps()): Promise<void> {
  const r = await startHeavyJob({ repo: msg.repo, branch: msg.branch, dir: msg.dir, command: msg.command, requestedBy: msg.requestedBy }, deps);
  if (!r.ok) send(ws, { t: 'error', message: r.error });
}

export async function cancelHeavyFrame(ws: WebSocket, id: string, deps: HeavyDeps = liveHeavyDeps()): Promise<void> {
  const r = await cancelHeavyJob(id, deps);
  if (!r.ok) send(ws, { t: 'error', message: r.error });
}
