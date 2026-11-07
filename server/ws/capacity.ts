import type { ServerMsg } from '../../shared/protocol';
import { CONFIG } from '../config';
import { memoryRunCap, readMemInfo } from './mem-guard';
import { threads } from './threads';
import { broadcast } from './broadcast';

export type CapacityFrame = Extract<ServerMsg, { t: 'capacity' }>;

export function capacityFrame(live: number, availMb: number, configCap: number): CapacityFrame {
  return { t: 'capacity', live, cap: memoryRunCap(availMb, configCap, live), configCap, availMb };
}

// Emits only when the live count or the effective cap moves: MemAvailable jitters
// every tick, and the browser cares about "2 of 3", not about the megabytes.
export function createCapacityPublisher(deps: {
  read: () => { live: number; availMb: number };
  configCap: number;
  emit: (f: CapacityFrame) => void;
}) {
  let last: CapacityFrame | null = null;
  const current = (): CapacityFrame => {
    const { live, availMb } = deps.read();
    return capacityFrame(live, availMb, deps.configCap);
  };
  const check = (): void => {
    const next = current();
    if (last && last.live === next.live && last.cap === next.cap && last.configCap === next.configCap) return;
    last = next;
    deps.emit(next);
  };
  return { check, current };
}

const publisher = createCapacityPublisher({
  read: () => ({ live: threads.size, availMb: readMemInfo().availMb }),
  configCap: CONFIG.maxConcurrentRuns,
  emit: broadcast,
});

threads.onChange = publisher.check;

export const publishCapacity = publisher.check;
export const currentCapacity = publisher.current;
