import * as THREE from 'three';
import type { LiveAction, LiveFloor } from '../liveAdapter';
import { journeyOf, funnelOf, ticketsOf } from '../panels';
import { practiceFloor, practiceSectors } from '../practiceFloor';
import { levelOf, Sim } from '../sim';
import type { Crate, Fx } from '../sim-types';
import { emptyHud, type HudState, type InspectView } from '../hudState';
import type { Store } from '../store';
import type { BaseMode, Floor, MonitorTab, Point, SectorId } from '../types';
import { Audio, SOUND_PACKS, type SoundPack } from './audio';
import { AgentView } from './characters';
import { attachInput } from './input';
import { box, disposeTree, ink, inkMat, newMat, PAL } from './kit';
import { Labels } from './labels';
import { drawMinimap } from './minimap';
import { H, W } from './monitor';
import { Particles } from './particles';
import { Rig } from './rig';
import { lightingAt } from './lighting';
import { World } from './world';

const KEY = { rules: 'deck-base-rules', xp: 'deck-base-xp', sound: 'deck-base-sound' };
const readJson = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

const EMPTY_FLOOR: Floor = { agents: [], wings: [], crates: [], packets: [], arcs: [], stations: [], mountainCount: 0, mountainLabel: 'BOARD NOT LOADED', gateBarsUp: false, machineOk: null, machineSpin: false, machineLabel: 'MCP: UNKNOWN', racks: [], clockLabel: 'NEXT RUN UNKNOWN', postBoard: null, beltMoving: false };

export interface EngineHandlers { act: (action: LiveAction) => void }
interface CrateView { g: THREE.Group; band: THREE.Mesh; flag: THREE.Group; star: THREE.Mesh }

export class BaseEngine {
  mode: BaseMode = 'live';
  sim: Sim;
  live: LiveFloor | null = null;
  floor: Floor = EMPTY_FLOOR;
  selectedId: string | null = null;
  hoverId: string | null = null;
  viewWingId: string | null = null;
  readonly rig = new Rig();
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private hemi = new THREE.HemisphereLight(0xfff1dc, 0x57504a, 1.05);
  private sun = new THREE.DirectionalLight(0xffe2b8, 1.9);
  private world: World;
  private particles: Particles;
  private labels: Labels;
  private audio = new Audio();
  private views = new Map<string, AgentView>();
  private rugs = new THREE.Group();
  private rugKey = '';
  private crateRoot = new THREE.Group();
  private crates = new Map<string, CrateView>();
  private packetRoot = new THREE.Group();
  private packets = new Map<number, THREE.Mesh>();
  private fxRoot = new THREE.Group();
  private cables: { id: string; t: number }[] = [];
  readonly pings: { pos: Point; t: number }[] = [];
  private lineMat = inkMat();
  private raf = 0;
  private clock = new THREE.Clock();
  private detachInput: () => void;
  private resizeObs: ResizeObserver;
  private width = 1; private height = 1;
  private moncycle = 0; private uiTick = 0;
  private speed = 1; private paused = false;
  private dim: SectorId | null = null;
  private journeyCrate: Crate | null = null;
  private funnelPrompt: number | null = null;
  private toastText = ''; private toastUntil = 0;
  private composer = false; private history = false;
  private pins = new Map<string, HTMLCanvasElement | null>();
  private minimap: HTMLCanvasElement | null = null;
  private replayIndex: number | null = null;
  private lastFrameError = false;

  constructor(private host: HTMLElement, labelsEl: HTMLElement, private store: Store<HudState>, private handlers: EngineHandlers) {
    this.sim = this.newSim();
    this.mode = 'live';
    this.scene.background = new THREE.Color(0x24232b);
    this.scene.fog = new THREE.Fog(0x24232b, 170, 330);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);
    this.scene.add(this.hemi);
    this.sun.position.set(-40, 80, 30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 1024);
    Object.assign(this.sun.shadow.camera, { left: -80, right: 80, top: 40, bottom: -40, far: 220 });
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun);
    this.world = new World(this.scene);
    this.particles = new Particles(this.scene);
    this.scene.add(this.rugs, this.crateRoot, this.packetRoot, this.fxRoot);
    this.labels = new Labels(labelsEl, { agent: (id) => this.select(id), wing: (id) => this.goWing(id), sector: (id) => this.goSector(id) });
    this.audio.pack = readJson<SoundPack>(KEY.sound, 'off');
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(host);
    this.resize();
    this.detachInput = attachInput(this);
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }

  private newSim(): Sim {
    return new Sim({ rules: readJson<Record<string, number>>(KEY.rules, {}), xp: readJson<number>(KEY.xp, 0), onRules: (r) => write(KEY.rules, r), onXp: (x) => write(KEY.xp, x) });
  }

  private resize() {
    this.width = Math.max(1, this.host.clientWidth);
    this.height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(this.width, this.height);
    this.rig.resize(this.width, this.height);
  }

  get viewport() { return { width: this.width, height: this.height, dom: this.renderer.domElement, camera: this.rig.camera, scene: this.scene }; }

  // ---- Commands from the HUD ----
  setMode(m: BaseMode) {
    if (m === this.mode) return;
    this.mode = m;
    this.closePanels();
    this.selectedId = null;
    this.pins.clear();
    this.rig.home();
    this.syncFloor();
    this.publish();
  }
  setLive(l: LiveFloor) { this.live = l; }
  home() { this.selectedId = null; this.viewWingId = null; this.closePanels(); this.rig.home(); this.publish(); }
  goWing(id: string) {
    const w = this.floor.wings.find((x) => x.id === id);
    if (!w) return;
    this.selectedId = null; this.viewWingId = id; this.closePanels(); this.rig.wing(w); this.publish();
  }
  goSector(id: SectorId) { this.selectedId = null; this.viewWingId = null; this.closePanels(); this.rig.sector(id); this.publish(); }
  toggleDim(id: SectorId) { this.dim = this.dim === id ? null : id; this.world.setDim(this.dim); this.publish(); }
  flyTo(p: Point) { this.selectedId = null; this.closePanels(); this.rig.fly(p); this.publish(); }
  select(id: string) {
    const a = this.floor.agents.find((x) => x.id === id);
    if (!a) return;
    this.closePanels();
    this.selectedId = id; this.viewWingId = a.wingId;
    this.rig.desk(a);
    this.publish();
  }
  back() {
    const wing = this.floor.agents.find((a) => a.id === this.selectedId)?.wingId;
    if (wing && this.floor.wings.some((w) => w.id === wing)) this.goWing(wing); else this.home();
  }
  escape() {
    if (this.funnelPrompt !== null || this.journeyCrate) this.closePanels();
    else if (this.selectedId) this.back();
    else this.home();
    this.publish();
  }
  focusDecision(id: string) {
    const d = this.decisions().find((x) => x.id === id);
    if (!d) return;
    if (d.focusAgentId) this.select(d.focusAgentId); else this.flyTo(d.pos);
  }
  nextDecision() {
    const first = this.decisions()[0];
    if (first) this.focusDecision(first.id); else this.toast('Nothing needs you');
  }
  choose(id: string, i: number) {
    if (this.mode === 'practice') this.sim.choose(id, i);
    else {
      const action = this.live?.decisions.find((d) => d.id === id)?.actions[i];
      if (action) this.handlers.act(action);
    }
    this.publish();
  }
  decisions() { return this.mode === 'practice' ? this.sim.sortedAlerts() : this.live?.decisions ?? []; }
  chooseFirst(i: number) {
    // Hotkeys only drive the game: a stray Q must never answer a real agent.
    if (this.mode !== 'practice') return;
    const first = this.sim.sortedAlerts()[0];
    if (first?.opts[i]) this.choose(first.id, i);
  }
  setSpeed(n: number) { this.speed = n; this.paused = false; this.publish(); }
  togglePause() { this.paused = !this.paused; this.toast(this.paused ? 'Paused. Decide calmly.' : 'Running'); }
  stepAway() { if (this.mode === 'practice') { this.sim.stepAway(); this.publish(); } }
  closeSince() { this.sim.since = null; this.publish(); }
  restart() {
    this.sim = this.newSim();
    this.closePanels(); this.selectedId = null; this.pins.clear(); this.replayIndex = null;
    this.syncFloor();
    this.publish();
  }
  acceptRule() { this.sim.acceptRule(); this.publish(); }
  dismissRule() { this.sim.ruleOffer = null; this.publish(); }
  removeRule(t: string) { this.sim.removeRule(t); this.publish(); }
  setComposer(on: boolean) { this.composer = on && this.mode === 'practice'; this.publish(); }
  sendPrompt(text: string, wingId: string, n: number) { this.sim.compose(text, wingId, n); this.composer = false; this.publish(); }
  toggleHistory() { this.history = !this.history; this.publish(); }
  openFunnel(id?: number) {
    if (this.mode !== 'practice') return;
    const p = id ?? this.sim.prompts.at(-1)?.id;
    if (p === undefined) return;
    this.closePanels(); this.funnelPrompt = p; this.publish();
  }
  openBranch(crateId?: number, agentId?: string) {
    const c = this.sim.crates.find((x) => x.id === crateId);
    if (c) this.showJourney(c); else if (agentId) this.select(agentId);
  }
  showJourney(c: Crate) { this.selectedId = null; this.closePanels(); this.journeyCrate = c; this.rig.home(); this.publish(); }
  clickCrate(id: string) {
    if (this.mode === 'practice') {
      const c = this.sim.crates.find((x) => `crate-${x.id}` === id);
      if (c) this.showJourney(c);
      return;
    }
    const title = this.floor.crates.find((c) => c.id === id)?.title;
    if (title) this.toast(`Card: ${title}`);
  }
  closePanels() { this.funnelPrompt = null; this.journeyCrate = null; this.publish(); }
  setTab(t: MonitorTab) { const a = this.selectedSim(); if (a) { a.tab = t; this.publish(); } }
  togglePaused() { const a = this.selectedSim(); if (a) { a.paused = !a.paused; this.sim.log(a, a.paused ? 'Interrupted by you' : 'Resumed by you'); this.publish(); } }
  toggleSupervised() { const a = this.selectedSim(); if (a) { a.supervised = !a.supervised; this.sim.log(a, `Mode: ${a.supervised ? 'supervised' : 'full'}`); this.publish(); } }
  tellPractice(text: string) { const a = this.selectedSim(); if (a) { a.next = text; this.sim.log(a, `You said: ${text}`); this.fx([{ kind: 'pop', agentId: a.id, k: 1 }]); this.toast(`${a.name} will do this next`); } }
  private selectedSim() { return this.mode === 'practice' ? this.sim.agents.find((a) => a.id === this.selectedId) : undefined; }
  pin(id: string) {
    if (this.pins.has(id)) return;
    if (this.pins.size >= 3) this.pins.delete([...this.pins.keys()][0]);
    this.pins.set(id, null);
    this.publish();
  }
  unpin(id: string) { this.pins.delete(id); this.publish(); }
  attachPin(id: string, c: HTMLCanvasElement | null) { if (this.pins.has(id)) this.pins.set(id, c); }
  attachMinimap(c: HTMLCanvasElement | null) { this.minimap = c; }
  cycleSound() {
    const next = SOUND_PACKS[(SOUND_PACKS.indexOf(this.audio.pack) + 1) % SOUND_PACKS.length];
    this.audio.pack = next;
    write(KEY.sound, next);
    this.audio.beep();
    this.publish();
  }
  scrub(index: number | null) {
    this.replayIndex = index;
    if (index !== null) {
      this.paused = true;
      const item = this.sim.feedLog[index];
      if (item?.pos) this.rig.fly(item.pos);
    } else { this.paused = false; this.rig.home(); }
    this.publish();
  }
  toast(t: string) { this.toastText = t; this.toastUntil = performance.now() + 3200; this.publish(); }
  minimapClick(xWorld: number) {
    const w = this.floor.wings.reduce<typeof this.floor.wings[number] | null>((b, o) => (!b || Math.abs(o.cx - xWorld) < Math.abs(b.cx - xWorld) ? o : b), null);
    if (w) this.goWing(w.id);
  }

  // ---- Frame ----
  private syncFloor() {
    this.floor = this.mode === 'practice' ? practiceFloor(this.sim) : this.live?.floor ?? EMPTY_FLOOR;
    const ids = new Set(this.floor.agents.map((a) => a.id));
    for (const [id, v] of this.views) if (!ids.has(id)) { v.dispose(); this.views.delete(id); this.pins.delete(id); if (this.selectedId === id) this.selectedId = null; }
    for (const a of this.floor.agents) if (!this.views.has(a.id)) this.views.set(a.id, new AgentView(this.scene, a.id, a));
    const rugKey = this.floor.wings.map((w) => `${w.id}:${w.colStart}:${w.cols}:${w.rug}`).join();
    if (rugKey !== this.rugKey) {
      this.rugKey = rugKey;
      disposeTree(this.rugs);
      this.rugs.clear();
      for (const w of this.floor.wings) {
        box(this.rugs, w.width - 0.6, 0.03, 15, 0x8a5a44, w.cx, 0.06, -6).castShadow = false;
        box(this.rugs, w.width - 1.2, 0.03, 14, w.rug, w.cx, 0.08, -6).castShadow = false;
      }
    }
    this.world.setStations(this.floor.stations);
    this.world.setRacks(this.floor.racks);
    this.syncCrates();
    this.syncPackets();
  }

  private makeCrate(id: string): CrateView {
    const g = new THREE.Group();
    const body = box(g, 1.1, 0.8, 1.1, PAL.wood, 0, 0.4, 0);
    ink(body, this.lineMat, 1.07);
    box(g, 1.14, 0.12, 1.14, PAL.woodDark, 0, 0.4, 0);
    const band = box(g, 1.16, 0.14, 1.16, PAL.green, 0, 0.72, 0);
    const flag = new THREE.Group();
    g.add(flag);
    box(flag, 0.06, 0.9, 0.06, PAL.char, 0.3, 1.2, 0);
    box(flag, 0.5, 0.3, 0.05, PAL.blue, 0.56, 1.5, 0);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), newMat(PAL.gold, { emissive: PAL.gold, emissiveIntensity: 0.9 }));
    star.position.y = 1.25;
    g.add(star);
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.userData.crateId = id; });
    this.crateRoot.add(g);
    return { g, band, flag, star };
  }

  private syncCrates() {
    const ids = new Set(this.floor.crates.map((c) => c.id));
    for (const [id, v] of this.crates) if (!ids.has(id)) { this.lineMatSafeDispose(v.g); this.crates.delete(id); }
    for (const c of this.floor.crates) {
      let v = this.crates.get(c.id);
      if (!v) { v = this.makeCrate(c.id); this.crates.set(c.id, v); }
      v.g.position.set(c.x, c.y, c.z);
      v.band.visible = !!c.band; v.flag.visible = !!c.flag; v.star.visible = !!c.star;
    }
  }

  // The ink material is shared across crates and outlives any one of them.
  private lineMatSafeDispose(g: THREE.Object3D) {
    g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); if (m.material !== this.lineMat) (m.material as THREE.Material).dispose(); } });
    g.removeFromParent();
  }

  private syncPackets() {
    const ids = new Set(this.floor.packets.map((p) => p.id));
    for (const [id, m] of this.packets) if (!ids.has(id)) { this.lineMatSafeDispose(m); this.packets.delete(id); }
    for (const p of this.floor.packets) {
      let m = this.packets.get(p.id);
      if (!m) { m = box(this.packetRoot, 0.55, 0.55, 0.55, p.color); ink(m, this.lineMat, 1.12); this.packets.set(p.id, m); }
      m.position.set(p.x, p.y, p.z);
      m.rotation.y += 0.07;
    }
  }

  private fx(list: Fx[]) {
    for (const f of list) {
      if (f.kind === 'burst') this.particles.burst(f.x, f.y, f.z, f.color, f.n, f.up);
      else if (f.kind === 'shake') this.rig.addShake(f.v);
      else if (f.kind === 'pop') this.views.get(f.agentId)?.pop(f.k);
      else if (f.kind === 'beep') this.audio.beep(f.f, f.d, f.wave, f.v);
      else if (f.kind === 'chord') this.audio.chord(f.fs);
      else if (f.kind === 'cable') this.cables.push({ id: f.agentId, t: 0 });
      else if (f.kind === 'walk') this.views.get(f.agentId)?.walkTo(f.to);
      else if (f.kind === 'toast') this.toast(f.text);
      else if (f.kind === 'ping') this.pings.push({ pos: f.pos, t: 0 });
    }
  }

  private drawLinks(T: number, real: number) {
    disposeTree(this.fxRoot);
    this.fxRoot.clear();
    if (this.selectedId) return;
    const tube = (a: THREE.Vector3, mid: THREE.Vector3, b: THREE.Vector3, color: number) => {
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      this.fxRoot.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.09, 5), new THREE.MeshBasicMaterial({ color, toneMapped: false })));
    };
    for (const c of this.floor.arcs) {
      tube(new THREE.Vector3(c.from.x, 4.4, c.from.z), new THREE.Vector3((c.from.x + c.to.x) / 2, 11, (c.from.z + c.to.z) / 2), new THREE.Vector3(c.to.x, 4.4, c.to.z), Math.sin(T * 6) > 0 ? 0xff5a44 : 0xffb0a2);
    }
    const hovered = this.floor.agents.find((a) => a.id === this.hoverId);
    if (hovered?.monitor.kind === 'practice' && hovered.monitor.hasJob) {
      // Hover shows declared intent: the route this desk's work will take to the belt.
      tube(new THREE.Vector3(hovered.x, 0.25, hovered.z + 3), new THREE.Vector3(hovered.x, 0.25, 3), new THREE.Vector3(hovered.x, 0.25, 7.6), 0xffc23d);
    }
    const machine = new THREE.Vector3(53, 3, -10);
    this.cables = this.cables.filter((c) => {
      c.t += real * 0.9;
      const a = this.floor.agents.find((x) => x.id === c.id);
      if (c.t > 1 || !a) return false;
      const f = new THREE.Vector3(a.x, 4, a.z), curve = new THREE.QuadraticBezierCurve3(f, new THREE.Vector3((f.x + machine.x) / 2, 15, (f.z + machine.z) / 2), machine);
      const dot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: this.floor.machineOk ? 0x7fe0d4 : 0xff5a44, toneMapped: false }));
      dot.position.copy(curve.getPoint(this.floor.machineOk ? c.t : c.t * 0.5));
      this.fxRoot.add(dot);
      return true;
    });
  }

  private frame() {
    this.raf = requestAnimationFrame(this.frame);
    try { this.tick(); } catch (e) {
      // One bad frame must not spam: report once and keep the RAF alive for the next data update.
      if (!this.lastFrameError) { this.lastFrameError = true; console.warn('[base] frame failed', e); }
    }
  }

  private tick() {
    const real = Math.min(this.clock.getDelta(), 0.05), T = this.clock.elapsedTime;
    if (this.mode === 'practice' && !this.paused && !this.sim.ended && !this.sim.since) {
      let left = real * this.speed;
      while (left > 0) { const d = Math.min(left, 0.1); this.sim.step(d); left -= d; }
    }
    this.syncFloor();
    if (this.mode === 'practice') { this.fx(this.sim.fx); this.sim.fx = []; }
    this.particles.step(real);
    this.world.update(real, T, this.floor);
    for (const a of this.floor.agents) this.views.get(a.id)?.animate(a, T, real, this.selectedId === a.id);
    this.drawLinks(T, real);
    for (let i = this.pings.length - 1; i >= 0; i--) { this.pings[i].t += real * 0.5; if (this.pings[i].t > 1) this.pings.splice(i, 1); }
    this.rig.update(real, T);
    const pressure = this.mode === 'practice' ? this.sim.pressure / 100 : 0;
    lightingAt(new Date().getHours(), pressure, this.hemi, this.sun);
    this.drawMonitors(T);
    this.renderer.render(this.scene, this.rig.camera);
    this.labels.update(this.floor.agents, this.floor.wings, this.sectors(), this.rig.camera, this.width, this.height, this.rig.zoomed, !!this.selectedId);
    this.uiTick += real;
    if (this.uiTick > 0.2) { this.uiTick = 0; this.publish(); if (this.minimap) drawMinimap(this.minimap, this.floor, this.pings); }
  }

  private drawMonitors(T: number) {
    const agents = this.floor.agents;
    if (!agents.length) return;
    this.moncycle = (this.moncycle + 1) % agents.length;
    const a = agents[this.moncycle];
    if (this.rig.zoomed || this.moncycle % 3 === 0) this.views.get(a.id)?.redraw(a, T);
    const sel = agents.find((x) => x.id === this.selectedId);
    if (sel) this.views.get(sel.id)?.redraw(sel, T);
    for (const [id, c] of this.pins) {
      const pa = agents.find((x) => x.id === id), v = this.views.get(id);
      if (!pa || !v || !c) continue;
      v.redraw(pa, T);
      c.getContext('2d')?.drawImage(v.cv, 0, 0, c.width, c.height);
    }
  }

  private sectors() { return this.mode === 'practice' ? practiceSectors(this.sim, this.floor) : this.live?.sectors ?? []; }

  private inspectView(): InspectView | null {
    const a = this.floor.agents.find((x) => x.id === this.selectedId);
    if (!a) return null;
    const base = { id: a.id, name: a.name, modelLabel: a.modelLabel, family: a.family, state: a.state, ctx: a.ctx };
    if (a.monitor.kind === 'live') return { ...base, sessionId: a.sessionId, running: a.state === 'working', tail: a.monitor.tail };
    const s = this.sim.agents.find((x) => x.id === a.id);
    return { ...base, tab: a.monitor.tab, paused: s?.paused, supervised: s?.supervised };
  }

  private publish() {
    const practice = this.mode === 'practice', s = this.sim;
    const funnelP = practice && this.funnelPrompt !== null ? s.prompts.find((p) => p.id === this.funnelPrompt) : undefined;
    if (performance.now() > this.toastUntil) this.toastText = '';
    const hud: HudState = {
      ...emptyHud(this.mode),
      alerts: this.decisions(),
      clock: practice ? s.t : 0, pressure: practice ? s.pressure : 0, streak: practice ? s.streak : 0,
      xp: s.xp, level: levelOf(s.xp), speed: this.speed, paused: this.paused,
      awaiting: practice ? s.alerts.length : this.live?.awaiting ?? 0,
      elsewhere: practice ? 0 : this.live?.elsewhere ?? 0,
      agentsShown: this.floor.agents.length,
      sectors: this.sectors(), dim: this.dim,
      wings: this.floor.wings.map((w) => ({ id: w.id, name: w.name })),
      tickets: practice ? ticketsOf(s) : [],
      inspect: this.inspectView(),
      journey: practice && this.journeyCrate ? journeyOf(s, this.journeyCrate) : null,
      funnel: funnelP ? funnelOf(funnelP) : null,
      feed: practice ? s.feedLog : [],
      rules: practice ? Object.keys(s.rules) : [],
      ruleOffer: practice ? s.ruleOffer : null,
      toast: this.toastText,
      since: practice ? s.since : null, end: practice ? s.end : null,
      composer: this.composer, history: practice && this.history,
      pins: [...this.pins.keys()].map((id) => ({ id, name: this.floor.agents.find((a) => a.id === id)?.name ?? id })),
      sound: this.audio.pack,
      replay: practice && this.replayIndex !== null ? { index: this.replayIndex, total: s.feedLog.length, item: s.feedLog[this.replayIndex] ?? null } : null,
      focused: !!this.selectedId,
    };
    this.store.set(hud);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.detachInput();
    this.labels.dispose();
    this.audio.dispose();
    this.particles.dispose();
    for (const v of this.views.values()) v.dispose();
    this.views.clear();
    disposeTree(this.scene);
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

export const PIN_SIZE = { w: W / 2, h: H / 2 };
