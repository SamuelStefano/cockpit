import type { AlertDef, Crate, SimAgent } from './sim-types';
import type { Sim } from './sim';

export interface AlertCtx { id?: string; a?: SimAgent; b?: SimAgent; file?: string; crate?: Crate; title?: string; deadline?: number; pos?: { x: number; y: number; z: number } }

type Def = (s: Sim, c: AlertCtx) => AlertDef;

// Every alert is a real choice with a price, never a "dismiss".
export const DECISIONS: Record<string, Def> = {
  conflict: (s, c) => {
    const a = c.a!, b = c.b!;
    const clear = () => { b.blockers.delete('conflict'); s.arcs = s.arcs.filter((x) => x.b !== b); };
    return {
      title: 'File conflict ahead', what: `${a.name} + ${b.name} → ${c.file}`, why: 'They will collide at merge',
      opts: [
        { label: `${a.name} goes first`, hint: `${b.name} waits`, rec: true, fn: () => { clear(); s.log(b, `Sequenced after ${a.name}`); if (b.job) b.job.dur += 4; s.fx.push({ kind: 'walk', agentId: b.id, to: { x: a.x, z: a.z } }); } },
        { label: 'Run both, fix at merge', hint: 'fast now, rework risk', fn: () => { clear(); if (b.job) b.job.conflicted = true; s.log(b, 'Allowed to collide'); } },
        { label: `Hand ${b.name} other work`, hint: 'loses its progress', fn: () => { clear(); b.progress = 0; s.log(b, 'Reassigned, progress lost'); } },
      ],
    };
  },
  silent: (s, c) => ({
    title: `${c.a!.name} went silent`, what: 'No output · process says “running”', why: 'Nothing else would have told you',
    opts: [
      { label: 'Nudge', hint: 'cheap, may repeat', rec: true, fn: () => { c.a!.silent = false; s.log(c.a!, 'Nudged by you, resumed'); } },
      { label: 'Restart from checkpoint', hint: 'lose 30%, stable', fn: () => { c.a!.silent = false; c.a!.progress = Math.max(0, c.a!.progress - 0.3); s.log(c.a!, 'Restarted from checkpoint'); } },
    ],
  }),
  lost: (s, c) => ({
    title: 'Message lost in delivery', what: `Said “sent”, ${c.a!.name} never got it`, why: 'Sent is not delivered',
    opts: [{ label: 'Redeliver', hint: 'pick it up off the floor', rec: true, fn: () => {
      c.a!.blockers.delete('lost'); s.log(c.a!, 'Brief redelivered by you');
      s.packet(c.pos!, s.deskPoint(c.a!), COLOR_PAPER, () => s.fx.push({ kind: 'pop', agentId: c.a!.id, k: 1 }));
    } }],
  }),
  quota: (s, c) => ({
    title: 'Claude quota exhausted', what: 'Every Opus, Sonnet and Haiku review stops', why: 'The review line has no reviewer',
    opts: [
      { label: 'Fall back to Grok', hint: 'keeps going, lower trust', rec: true, fn: () => { s.flags.quotaOut = false; c.a!.blockers.delete('quota'); c.a!.family = 'grok'; s.log(c.a!, 'Fell back to Grok'); } },
      { label: 'Wait for the reset', hint: 'line stops 30s', fn: () => { c.a!.blockers.delete('quota'); s.flags.quotaOut = false; s.flags.quotaResetAt = s.t + 30; s.log(c.a!, 'Waiting for quota reset'); } },
    ],
  }),
  migration: (s, c) => ({
    title: 'Migration at the gate', what: c.crate!.title, why: 'Irreversible · target: production schema', risk: 'UNSAFE',
    opts: [
      { label: 'Approve and open', hint: 'you own this', rec: true, fn: () => { c.crate!.cleared = true; s.flags.barsOpenUntil = s.t + 3; } },
      { label: 'Send it back', hint: 'safer, costs time', fn: () => s.sendBack(c.crate!, 'Migration sent back by you') },
    ],
  }),
  finding: (s, c) => ({
    title: 'Reviewer found a risk', what: c.crate!.title, why: `Possible authz gap in ${c.crate!.file}`, risk: 'MAYBE',
    opts: [
      { label: 'Send it back', hint: 'costs time, stays safe', rec: true, fn: () => s.sendBack(c.crate!, 'Review finding, sent back') },
      { label: 'Merge anyway', hint: 'may break in production', fn: () => { c.crate!.tainted = true; c.crate!.held = false; s.log(c.crate!.a, 'Merged over a finding'); } },
    ],
  }),
  deploy: (s, c) => ({
    title: 'Merged but not live', what: c.crate!.title, why: 'Deploy waits for an idle machine that never idles',
    opts: [
      { label: 'Force deploy', hint: 'restarts the relay', rec: true, fn: () => { c.crate!.held = false; s.log(c.crate!.a, 'Deploy forced'); } },
      { label: 'Pause other agents', hint: 'clean, slows everyone 8s', fn: () => { c.crate!.held = false; s.flags.slowUntil = s.t + 8; } },
    ],
  }),
  post: (s, c) => ({
    title: 'Post needs approval', what: 'Scheduled reel · cover attached', why: 'It publishes publicly', deadline: c.deadline,
    opts: [
      { label: 'Approve', hint: 'goes out on time', rec: true, fn: () => { s.flags.postDeadline = 0; s.flags.postColor = 0x4f9d58; } },
      { label: 'Reschedule', hint: 'loses the slot', fn: () => { s.flags.postDeadline = 0; s.flags.postColor = 0xb5bac0; } },
    ],
  }),
  context: (s, c) => ({
    title: `${c.a!.name} at ${Math.round(c.a!.ctx * 100)}% context`, what: 'Quality falls near the limit', why: 'A handoff now is cleaner',
    opts: [
      { label: 'Hand off to a fresh session', hint: 'pause 3s, clean', rec: true, fn: () => { c.a!.ctx = 0.14; c.a!.stunUntil = s.t + 3; c.a!.ctxAsked = false; s.log(c.a!, 'Handed off to fresh session'); } },
      { label: 'Let it finish', hint: 'errors more likely', fn: () => { c.a!.ctxAsked = true; if (c.a!.job) c.a!.job.tired = true; s.log(c.a!, 'Kept going at high context'); } },
    ],
  }),
  mcp: (s) => ({
    title: 'MCP token expired', what: 'Agents calling it are stalling', why: 'Tokens last 7 days',
    opts: [{ label: 'Refresh the token', hint: 'one click', rec: true, fn: () => { s.flags.mcpDown = false; } }],
  }),
  disk: (s) => ({
    title: 'Sample box disk at 97%', what: 'Builds here can kill sessions', why: 'Heavy work belongs elsewhere',
    opts: [
      { label: 'Send heavy jobs away', hint: 'needs the other box online', rec: true, fn: () => { s.flags.disk = 0.7; } },
      { label: 'Clean old worktrees', hint: '5s pause for the wing', fn: () => { s.flags.disk = 0.6; s.flags.slowUntil = s.t + 5; } },
    ],
  }),
  regression: (s, c) => ({
    title: 'Production regression', what: c.title ?? '', why: 'You merged over a review finding', risk: 'UNSAFE',
    opts: [{ label: 'Roll back', hint: 'crate returns, costs time', rec: true, fn: () => { s.regressions++; } }],
  }),
};
const COLOR_PAPER = 0xf4ead6;

// Irreversible or public actions never become rules: a person always signs those.
export function canBecomeRule(type: string, risk?: string): boolean {
  return risk !== 'UNSAFE' && type !== 'post';
}
