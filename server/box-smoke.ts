import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Role } from './auth';
import type { ClaudeEvent } from './engine/events';
import { run, type RunOpts } from './engine/claude';
import { smokeHint, type SmokeResult } from '../shared/box-health';

// "Testar máquina": one tiny real prompt through the same engine every chat turn
// uses (same binary, args builder, env and exit translation), with the cheapest
// model. Its cwd is outside CONFIG.workdir so the transcript never shows up as a
// chat in the sidebar.
const SMOKE_CWD = join(homedir(), '.cockpit', 'smoke');
export const SMOKE_TIMEOUT_MS = 90_000;
export const SMOKE_PROMPT = 'Responda apenas: ok';

export type Runner = (opts: RunOpts) => { kill: () => void };

export function runSmoke(role: Role, runner: Runner = run, now = () => Date.now(), timeoutMs = SMOKE_TIMEOUT_MS): Promise<SmokeResult> {
  try { mkdirSync(SMOKE_CWD, { recursive: true }); } catch { /* run() reports the missing cwd */ }
  const started = now();
  return new Promise((resolve) => {
    let error = '';
    let answered = false;
    let done = false;
    const finish = (r: Omit<SmokeResult, 'state' | 'ms'>) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ state: 'done', ms: now() - started, ...r });
    };
    const fail = (msg: string) => finish({ ok: false, error: msg, hint: smokeHint(msg) });
    let handle: { kill: () => void } | null = null;
    const timer = setTimeout(() => { handle?.kill(); fail(`o claude não respondeu em ${Math.round(timeoutMs / 1000)}s (timeout)`); }, timeoutMs);
    timer.unref?.();
    try {
      handle = runner({
        prompt: SMOKE_PROMPT,
        model: 'haiku',
        effort: 'low',
        mode: 'plan',
        role,
        cwd: SMOKE_CWD,
        onEvent: (ev: ClaudeEvent) => {
          if (ev.type !== 'result') return;
          if (ev.is_error) error = ev.result || ev.subtype || 'erro sem mensagem';
          else answered = true;
        },
        onError: (msg) => { error ||= msg; },
        onClose: () => {
          if (answered && !error) finish({ ok: true });
          else fail(error || 'o claude saiu sem responder');
        },
      });
    } catch (e) {
      fail((e as Error).message);
    }
  });
}

let inflight: Promise<SmokeResult> | null = null;

// One at a time per box: a double click must not spawn two prompts.
export function smokeOnce(role: Role): Promise<SmokeResult> {
  inflight ??= runSmoke(role).finally(() => { inflight = null; });
  return inflight;
}
