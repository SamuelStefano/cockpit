import { canBecomeRule, DECISIONS, type AlertCtx } from './decisions';
import { spawnCrate, stepCrate } from './crates';
import { composedJobs, script, type ScriptEvent } from './script';
import { layoutWings, slotPosition } from './sectors';
import { COLORS, SPOTS, type ConflictArc, type Crate, type EndSummary, type FeedItem, type Fx, type Job, type JobSpec, type Packet, type RuleOffer, type SimAgent, type SimAlert, type SimPrompt, type SinceSummary } from './sim-types';
import type { AgentState, ModelFamily, Point, Wing } from './types';

const TOOLS = ['Read', 'Grep', 'Edit', 'Edit', 'npm test', 'MCP: plans', 'Skill: code-style', 'gh pr create', 'MCP: engineering', 'tsc'];
type Roster = [string, ModelFamily][];
const ROSTERS: { id: string; name: string; roster: Roster }[] = [
  { id: 'team', name: 'Team Room', roster: [['Lead', 'grok'], ['Front', 'sonnet'], ['API', 'sonnet'], ['Schema', 'sonnet'], ['Security', 'grok']] },
  { id: 'sample-a', name: 'Sample Wing A', roster: [['Author', 'sonnet'], ['Scenes', 'opus'], ['Player', 'sonnet'], ['Audit', 'haiku'], ['QA', 'haiku'], ['Live', 'codex']] },
  { id: 'sample-b', name: 'Sample Wing B', roster: [['Relay', 'sonnet'], ['Canvas', 'sonnet'], ['Agent', 'codex'], ['Eng', 'grok'], ['Rev', 'grok'], ['Ops', 'haiku']] },
];

export const scoreShift = (peak: number, missed: boolean, regressions: number, auto: number) => Math.max(0, 100 - Math.round(peak * 0.6) - (missed ? 15 : 0) - regressions * 15 + Math.min(10, auto));
export const rankOf = (score: number) => (score >= 85 ? 'S' : score >= 70 ? 'A' : score >= 50 ? 'B' : 'C');
export const levelOf = (xp: number) => 1 + Math.floor(xp / 200);

export interface SimOptions { seed?: number; rules?: Record<string, number>; xp?: number; onRules?: (r: Record<string, number>) => void; onXp?: (xp: number) => void }

// Pure game state: no three.js, no DOM. The engine renders it and drains `fx`.
export class Sim {
  t = 0; pressure = 0; peak = 0; streak = 0; best = 0; handled = 0; autoHandled = 0; regressions = 0; seq = 0;
  xp: number;
  rules: Record<string, number>;
  ended = false;
  end: EndSummary | null = null;
  since: SinceSummary | null = null;
  ruleOffer: RuleOffer | null = null;
  alerts: SimAlert[] = [];
  crates: Crate[] = [];
  packets: Packet[] = [];
  prompts: SimPrompt[] = [];
  feedLog: FeedItem[] = [];
  fx: Fx[] = [];
  arcs: ConflictArc[] = [];
  silentChecks: { a: SimAgent; t: number }[] = [];
  picks: Record<string, Record<number, number>> = {};
  flags = { quotaOut: false, quotaResetAt: 0, slowUntil: 0, reviewNow: 0, barsOpenUntil: 0, mcpDown: false, postDeadline: 0, postColor: 0xf2c14e, postMissed: false, disk: 0.97 };
  agents: SimAgent[] = [];
  wings: Wing[];
  planner: SimAgent;
  private seed: number;
  private events: ScriptEvent[] = script();
  private nextEvent = 26;
  private opts: SimOptions;

  constructor(opts: SimOptions = {}) {
    this.opts = opts;
    this.seed = opts.seed ?? 20261030;
    this.rules = { ...(opts.rules ?? {}) };
    this.xp = opts.xp ?? 0;
    this.wings = layoutWings(ROSTERS.map((r) => ({ id: r.id, name: r.name, count: r.roster.length }))).wings;
    this.planner = this.makeAgent('planner', 'Planner', 'opus', null, SPOTS.planner, true);
    this.agents.push(this.planner);
    for (const r of ROSTERS) {
      const wing = this.wings.find((w) => w.id === r.id)!;
      r.roster.forEach(([name, fam], i) => this.agents.push(this.makeAgent(`${r.id}-${i}`, name, fam, wing, slotPosition(wing, i), false)));
    }
  }

  private makeAgent(id: string, name: string, family: ModelFamily, wing: Wing | null, p: Point, planner: boolean): SimAgent {
    return { id, name, family, wing, planner, x: p.x, z: p.z, progress: 0, job: null, queue: [], paused: false, blockers: new Set(), silent: false, asleep: false, planning: null, phase: this.rnd() * 6, log: [], next: 'Waiting for work', tab: 'split', ctx: 0.1 + this.rnd() * 0.3, supervised: true, tool: '', toolT: 0, term: [], state: 'waiting', cheerUntil: 0, stunUntil: 0, ctxAsked: false };
  }

  rnd(): number { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  pick<T>(a: T[]): T { return a[Math.floor(this.rnd() * a.length)]; }
  nextId(): number { return ++this.seq; }
  wingAgents(id: string): SimAgent[] { return this.agents.filter((a) => a.wing?.id === id); }
  deskPoint(a: SimAgent) { return { x: a.x, y: 2, z: a.z + 0.2 }; }
  log(a: SimAgent, msg: string) { a.log.push({ t: this.t, msg }); }
  feed(msg: string, kind: FeedItem['kind'] = 'info', pos: Point | null = null) { this.feedLog.push({ t: this.t, msg, kind, pos: pos && { x: pos.x, z: pos.z } }); }
  packet(from: Packet['from'], to: Packet['to'], color: number, then?: () => void, dur = 1.6) { this.packets.push({ id: this.nextId(), from, to, t: 0, dur, color, then }); }

  raise(type: string, ctx: AlertCtx, pos: Point, focusAgentId?: string) {
    const id = `${type}-${ctx.id ?? (ctx.a?.id ?? '') + (ctx.crate?.id ?? '')}`;
    if (this.alerts.some((x) => x.id === id)) return;
    const al: SimAlert = { id, type, born: this.t, pos: { x: pos.x, z: pos.z }, focusAgentId, ...DECISIONS[type](this, ctx) };
    const ruled = this.rules[type];
    if (ruled !== undefined && al.opts[ruled]) {
      al.opts[ruled].fn();
      this.autoHandled++;
      this.feed(`Rule answered: ${al.title} → ${al.opts[ruled].label}`, 'rule', pos);
      return;
    }
    this.alerts.push(al);
    this.fx.push({ kind: 'beep', f: 880, d: 0.2 }, { kind: 'ping', pos: al.pos });
    this.feed(al.title, 'alert', pos);
  }

  sortedAlerts(): SimAlert[] {
    return [...this.alerts].sort((a, b) => (a.deadline ?? a.born + 1e4) - (b.deadline ?? b.born + 1e4));
  }

  choose(id: string, i: number) {
    const al = this.alerts.find((a) => a.id === id), o = al?.opts[i];
    if (!al || !o) return;
    o.fn();
    this.alerts = this.alerts.filter((a) => a !== al);
    const fast = this.t - al.born < 15;
    this.streak = fast ? this.streak + 1 : 0;
    this.best = Math.max(this.best, this.streak);
    this.handled++;
    this.xp += 10 + (fast ? 5 : 0) * Math.min(this.streak, 4);
    this.opts.onXp?.(this.xp);
    this.feed(`You: ${al.title} → ${o.label}`, 'you', al.pos);
    this.fx.push({ kind: 'burst', x: al.pos.x, y: 3, z: al.pos.z, color: COLORS.gold, n: 8, up: 6 }, { kind: 'beep', f: 520, d: 0.1 });
    const picks = (this.picks[al.type] ??= {});
    picks[i] = (picks[i] ?? 0) + 1;
    if (picks[i] === 2 && this.rules[al.type] === undefined && canBecomeRule(al.type, al.risk)) {
      this.ruleOffer = { type: al.type, index: i, title: al.title.replace(/ at \d+%.*/, ''), label: o.label };
    }
  }

  acceptRule() {
    if (!this.ruleOffer) return;
    this.rules[this.ruleOffer.type] = this.ruleOffer.index;
    this.ruleOffer = null;
    this.opts.onRules?.(this.rules);
    this.fx.push({ kind: 'toast', text: 'Rule saved. You will not be asked again.' });
  }
  removeRule(type: string) { delete this.rules[type]; this.opts.onRules?.(this.rules); }

  sendBack(c: Crate, why: string) {
    const a = c.a, j = c.job;
    c.held = false;
    this.crates.splice(this.crates.indexOf(c), 1);
    this.log(a, why);
    this.feed(`${c.title} went back to ${a.name}`, 'info', a);
    j.needsGate = false; j.risky = false; j.dur *= 0.5; j.rework = (j.rework ?? 0) + 1; j.crate = undefined;
    this.queueJob(a, j, true);
    a.progress = 0.3;
  }

  newPrompt(title: string, wingId: string, specs: JobSpec[], planDur = 5): SimPrompt {
    const p: SimPrompt = { id: this.nextId(), title, wingId, t: this.t, jobs: [], planDur };
    this.prompts.push(p);
    this.fx.push({ kind: 'toast', text: `New prompt: “${title}”` });
    this.feed(`Prompt in: ${title}`, 'info', SPOTS.gate);
    const planner = this.planner;
    this.packet({ x: SPOTS.gate.x, y: 1.5, z: SPOTS.gate.z }, this.deskPoint(planner), COLORS.gold, () => {
      this.fx.push({ kind: 'pop', agentId: planner.id, k: 1.2 });
      this.log(planner, `Prompt received: ${title}`);
      p.jobs = specs.map((sp) => ({ ...sp, prompt: p, stage: 'plan' }));
      planner.planning = { t: 0, dur: planDur, p };
      planner.next = 'Hand out the briefs';
    }, 2);
    return p;
  }

  compose(text: string, wingId: string, n: number) { this.newPrompt(text, wingId, composedJobs(this, text, n)); }

  private dispatch(p: SimPrompt) {
    const crew = this.wingAgents(p.wingId);
    p.jobs.forEach((j, i) => {
      const a = crew[j.to ?? i] ?? crew[i % crew.length];
      if (j.lost) {
        const pos = { x: a.x - 3.5, y: 0.35, z: a.z + 2.4 };
        a.blockers.add('lost');
        this.queueJob(a, j);
        this.packet(this.deskPoint(this.planner), pos, COLORS.paper, () => this.raise('lost', { a, pos }, pos, a.id));
        return;
      }
      this.packet(this.deskPoint(this.planner), this.deskPoint(a), COLORS.gold, () => {
        this.fx.push({ kind: 'pop', agentId: a.id, k: 1 });
        this.log(a, `Brief received: ${j.task}`);
        this.queueJob(a, j);
      });
    });
  }

  private queueJob(a: SimAgent, j: Job, front = false) {
    j.a = a; j.stage = 'code';
    if (front) a.queue.unshift(j); else a.queue.push(j);
  }

  private ambient() {
    const busy = this.agents.filter((a) => a.job && !a.blockers.size && !a.silent && !a.planner && a.wing?.id !== 'team');
    if (!busy.length) return;
    const a = this.pick(busy);
    if (this.rnd() < 0.5) { a.silent = true; this.log(a, 'No output since this moment'); this.silentChecks.push({ a, t: this.t + 6 }); return; }
    const b = busy.find((o) => o !== a && o.wing === a.wing);
    if (!b) return;
    a.blockers.add('conflict');
    this.arcs.push({ a: b, b: a });
    this.raise('conflict', { a: b, b: a, file: a.job?.file, id: `${a.id}${this.t | 0}` }, b, b.id);
  }

  private stateOf(a: SimAgent): AgentState {
    if (a.asleep && (this.flags.quotaOut || this.t < this.flags.quotaResetAt)) return 'asleep';
    if (a.asleep) a.asleep = false;
    if (a.paused) return 'paused';
    if (a.blockers.size) return 'blocked';
    if (a.silent) return 'silent';
    if (a.planner && !a.planning && this.t < this.flags.reviewNow) return 'reviewing';
    if (a.planning) return 'thinking';
    if (!a.job) return 'waiting';
    return Math.sin(a.phase + this.t * 0.35) > 0.55 ? 'thinking' : 'working';
  }

  private stepAgent(a: SimAgent, dt: number, slow: number) {
    if (a.planning) {
      a.planning.t += dt;
      if (a.planning.t >= a.planning.dur) { const p = a.planning.p; a.planning = null; this.log(a, 'Plan ready, briefs sent'); a.next = 'Review the PRs'; this.dispatch(p); }
    }
    if (!a.job && a.queue.length) { a.job = a.queue.shift()!; a.progress = a.job.rework ? 0.3 : 0; a.next = 'Run the tests'; }
    a.state = this.stateOf(a);
    if (!a.job || (a.state !== 'working' && a.state !== 'thinking') || this.t < a.stunUntil || this.flags.mcpDown) return;
    a.progress = Math.min(1, a.progress + (dt * slow) / a.job.dur);
    a.ctx = Math.min(0.97, a.ctx + dt * 0.006);
    a.toolT -= dt;
    if (a.toolT <= 0) {
      a.toolT = 1.8 + this.rnd() * 3; a.tool = this.pick(TOOLS);
      a.term.push(`$ ${a.tool}`);
      if (a.term.length > 11) a.term.shift();
      if (a.tool.startsWith('MCP') || a.tool.startsWith('Skill')) this.fx.push({ kind: 'cable', agentId: a.id });
    }
    if (a.ctx > 0.8 && !a.ctxAsked) { a.ctxAsked = true; this.raise('context', { a }, a, a.id); }
    if (a.progress >= 1) { const j = a.job; a.job = null; a.tool = ''; spawnCrate(this, a, j); a.next = a.queue.length ? 'Next task in queue' : 'Watching the PR'; }
  }

  step(dt: number) {
    this.t += dt;
    const slow = this.t < this.flags.slowUntil ? 0.35 : 1;
    for (const e of this.events) if (!e.fired && this.t >= e.t) { e.fired = true; e.f(this); }
    this.silentChecks = this.silentChecks.filter((s) => {
      if (this.t < s.t) return true;
      if (s.a.silent) this.raise('silent', { a: s.a }, s.a, s.a.id);
      return false;
    });
    if (this.t > this.nextEvent && this.t < 200 && !this.ended) { this.nextEvent = this.t + 16 + this.rnd() * 10; this.ambient(); }
    for (const a of this.agents) this.stepAgent(a, dt, slow);
    for (const c of [...this.crates]) if (!c.done) stepCrate(this, c, dt * slow);
    for (const p of [...this.packets]) {
      p.t += dt / p.dur;
      if (p.t >= 1) { this.packets.splice(this.packets.indexOf(p), 1); p.then?.(); }
    }
    this.pressure = this.alerts.length ? Math.min(100, this.pressure + this.alerts.length * 0.42 * dt) : Math.max(0, this.pressure - 2.2 * dt);
    this.peak = Math.max(this.peak, this.pressure);
    const f = this.flags;
    if (f.postDeadline && this.t > f.postDeadline) {
      f.postDeadline = 0; f.postMissed = true; f.postColor = COLORS.red;
      this.pressure = Math.min(100, this.pressure + 25);
      this.alerts = this.alerts.filter((a) => a.type !== 'post');
      this.feed('Post missed its slot', 'bad', SPOTS.post);
      this.fx.push({ kind: 'shake', v: 0.5 });
    }
    const jobs = this.prompts.flatMap((p) => p.jobs);
    if (!this.ended && this.events.every((e) => e.fired) && jobs.length && jobs.every((j) => j.crate?.done)) this.finish(jobs.length);
  }

  private finish(prs: number) {
    this.ended = true;
    const score = scoreShift(this.peak, this.flags.postMissed, this.regressions, this.autoHandled);
    this.end = { rank: rankOf(score), score, prs, time: this.t, peak: Math.round(this.peak), handled: this.handled, auto: this.autoHandled, regressions: this.regressions, missed: this.flags.postMissed, best: this.best, rules: Object.keys(this.rules).length };
    this.opts.onXp?.(this.xp);
    this.fx.push({ kind: 'chord', fs: [523, 659, 784, 1047] });
  }

  // Two "hours" of real life, compressed into 2 sim minutes.
  stepAway() {
    const from = this.feedLog.length, t0 = this.t, before = this.pressure;
    for (let i = 0; i < 1200; i++) this.step(0.1);
    const order: Record<FeedItem['kind'], number> = { bad: 0, alert: 1, good: 2, you: 3, rule: 3, info: 4 };
    const items = this.feedLog.slice(from).sort((a, b) => order[a.kind] - order[b.kind]);
    const n = (k: FeedItem['kind']) => items.filter((i) => i.kind === k).length;
    this.since = { verified: n('good'), waiting: this.alerts.length, lost: n('bad'), rules: n('rule'), pressure: Math.round(this.pressure - before), items: items.slice(0, 9), t0 };
  }

  barsUp(): boolean {
    return !(this.t < this.flags.barsOpenUntil) && this.crates.some((c) => !c.done && c.job.needsGate && !c.cleared && c.x > -4 && c.x < 0);
  }
}

