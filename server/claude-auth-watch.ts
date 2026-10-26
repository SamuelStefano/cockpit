import type { ServerMsg } from '../shared/protocol';
import { claudeReady } from './admin-ops';
import { broadcast } from './ws/broadcast';

export const CLAUDE_AUTH_POLL_MS = 5_000;

export interface ClaudeAuthWatchDeps {
  ready: () => boolean;
  emit: (msg: ServerMsg) => void;
  intervalMs: number;
}

// One poller per process: a login done in the Deck terminal writes the credentials
// file without telling anyone, so the "connect your account" banner must be told.
export function createClaudeAuthWatch(deps: ClaudeAuthWatchDeps) {
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

  const check = () => {
    if (!deps.ready()) return;
    stop();
    deps.emit({ t: 'claude-auth', ready: true });
  };

  function ensure() {
    if (timer || deps.ready()) return;
    timer = setInterval(check, deps.intervalMs);
    timer.unref();
  }

  // Terminal exited: re-check now instead of waiting for the next tick.
  function kick() { if (timer) check(); }

  return { ensure, kick, stop };
}

export const claudeAuthWatch = createClaudeAuthWatch({
  ready: () => claudeReady(),
  emit: (msg) => broadcast(msg),
  intervalMs: CLAUDE_AUTH_POLL_MS,
});
