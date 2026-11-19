import Phaser from 'phaser';
import { DUST_ANCHOR, DUST_FPS, DUST_FRAME, DUST_FRAMES, DUST_POOL, dustAllowed, dustTick, lookahead, surfaceOfProps, runSpeed, stickRuns } from './world-run';
import type { WorldHandle, WorldOptions } from './world-scene';
import type { NpcView, WorldView } from './world-state';
import { parseFocus, wheelStep, type CameraMode } from './camera-mode';
import { nudgePills } from './pill-layout';
import { V2_TILE_LAYERS, objects, propsOf, rectOf, tileOf, type Pt, type V2Map } from './world-v2-check';
import {
  AVATAR_SHEET, animFrames, animKey, botAnim, boxBlocked, buildLayout, charDepth, depthsFor, findPathV2, fitZoomV2, frameAt, isTypingTarget,
  nearestReachable, pcAnimName, pcState, pickZoom, resolveSeats, sheetFor, standPoint, stepZoomV2, tileAnimFrame, tileAnimations, tileAt,
  gaitAnim, groundProps, type BotAnim, type BotsMeta, type Face4, type PcState, type Seat, type TileAnim, type V2Depths, type V2Layout,
} from './world-v2-layout';

const BASE = import.meta.env.BASE_URL;
const V2 = `${BASE}world/v2/`;
const FONT = 'KenneyMini';
const MAP_KEY = 'v2-map';
const BOTS_KEY = 'v2-bots';
const PC_KEY = 'v2-pc';

const GREEN = 0x3fd17f;
const GREY = 0x8d8a85;
const AMBER = 0xf5a524;
const MEET = 0xa78bfa;
const INK = 0x0a0908;
const PILL = 0x14110f;
const PILL_LINE = 0x39342e;

const AVATAR_SPEED = 130;
const BOT_SPEED = 90;
const FOOT_HALF_W = 6;
const FOOT_H = 6;
const PC_LIFT = 21;
const LIGHTS_ALPHA = 0.5;
const JUMP_MS = 760;
const JUMP_PX = 10;
const TICK_MS = 80;

const modeColor = (m: NpcView['mode'], meeting = false): number => (meeting ? MEET : m === 'working' ? GREEN : m === 'waiting' ? AMBER : GREY);
const sheetTexture = (sheet: string): string => `v2-bot-${sheet}`;
const faceFrom = (dx: number, dy: number): Face4 => (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'));

export async function loadWorldFont(): Promise<void> {
  if (typeof FontFace === 'undefined') return;
  const face = new FontFace(FONT, `url(${BASE}world/kenney-mini-square.ttf)`);
  await face.load();
  document.fonts.add(face);
}

interface PcMeta {
  frames: Record<string, { x: number; y: number; w: number; h: number }>;
  animations?: Record<string, { frames: string[]; fps: number }>;
}

interface Pill {
  c: Phaser.GameObjects.Container;
  text: Phaser.GameObjects.Text;
  g: Phaser.GameObjects.Graphics;
  badge: Phaser.GameObjects.Text | null;
  h: number;
  w: number;
}

interface Bot {
  view: NpcView;
  sprite: Phaser.GameObjects.Sprite;
  pill: Pill;
  sheet: string;
  seat: Seat;
  route: Pt[];
  face: Face4;
  jumpAt: number;
  lift: number;
}

interface Pc { img: Phaser.GameObjects.Image; view: string; bot: string | null; mapState: PcState }
interface AnimatedTile { tile: Phaser.Tilemaps.Tile; anim: TileAnim }

type KeyName = 'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'SHIFT';

class WorldSceneV2 extends Phaser.Scene {
  private readonly opts: WorldOptions & { onError?: () => void };
  private failed = false;
  private mode: CameraMode;
  private recording = false;
  private ready = false;
  private pendingView: WorldView | null = null;
  private raw!: V2Map;
  private meta!: BotsMeta;
  private layout!: V2Layout;
  private depths!: V2Depths;
  private worldW = 0;
  private worldH = 0;
  private bots = new Map<string, Bot>();
  private pills: Pill[] = [];
  private pcs: Pc[] = [];
  private animated: AnimatedTile[] = [];
  private sheetState = new Map<string, 'loading' | 'ready' | 'failed'>();
  private labelScale = 1;
  private avatar!: Phaser.GameObjects.Sprite;
  private avatarPill!: Pill;
  private avatarFace: Face4 = 'down';
  private route: Pt[] = [];
  private marker!: Phaser.GameObjects.Ellipse;
  private keys: Record<KeyName, Phaser.Input.Keyboard.Key> | null = null;
  private downAt = new Map<number, Pt>();
  private pinchDist = 0;
  private pinchRatio = 1;
  private wheelAcc = 0;
  private pinching = false;
  private userZoomed = false;
  private userMoved = false;
  private selecting = false;
  private selected = new Set<string>();
  private rings = new Map<string, Phaser.GameObjects.Ellipse>();
  private lastCelebrate: string[] | null = null;
  private lastTick = 0;
  private fpsEl: HTMLDivElement | null = null;
  private fpsFrames = 0;
  private fpsSince = 0;

  constructor(opts: WorldOptions & { onError?: () => void }) {
    super('world-v2');
    this.opts = opts;
    this.mode = opts.mode;
  }

  private fail(): void {
    if (this.failed) return;
    this.failed = true;
    this.opts.onError?.();
  }

  private watchCritical(): void {
    this.load.on('loaderror', (f: { key?: string }) => {
      const k = f.key ?? '';
      if (k === MAP_KEY || k === BOTS_KEY || k === PC_KEY || k.startsWith('v2-ts-')) this.fail();
    });
  }

  preload(): void {
    this.watchCritical();
    this.load.tilemapTiledJSON(MAP_KEY, `${V2}world.tmj`);
    this.load.json(BOTS_KEY, `${V2}bots.json`);
    this.load.json(PC_KEY, `${V2}pc.json`);
    this.load.spritesheet('dust', `${V2}fx/dust.png`, { frameWidth: DUST_FRAME, frameHeight: DUST_FRAME });
  }

  private dust: Phaser.GameObjects.Sprite[] = [];
  private dustNext = 0;
  private lookDir = { x: 0, y: 0 };
  private dustAcc = 0;
  private look = { x: 0, y: 0 };

  private buildDust(): void {
    if (!this.textures.exists('dust')) return;
    this.anims.create({ key: 'dust-run', frames: this.anims.generateFrameNumbers('dust', { start: 0, end: DUST_FRAMES - 1 }), frameRate: DUST_FPS, repeat: 0 });
    for (let i = 0; i < DUST_POOL; i++) {
      const s = this.add.sprite(0, 0, 'dust', 0).setOrigin(DUST_ANCHOR.x / DUST_FRAME, DUST_ANCHOR.y / DUST_FRAME).setVisible(false);
      s.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.setVisible(false));
      this.dust.push(s);
    }
  }

  private puff(x: number, y: number, dx: number, dy: number): void {
    const s = this.dust[this.dustNext];
    if (!s) return;
    this.dustNext = (this.dustNext + 1) % this.dust.length;
    s.setPosition(Math.round(x - dx * 4), Math.round(y - dy * 3)).setDepth(charDepth(this.depths, y) - 1).setFlipX(this.dustNext % 2 === 0).setVisible(true).play('dust-run');
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor(INK);
    cam.roundPixels = true;
    const raw = (this.cache.tilemap.get(MAP_KEY) as { data?: V2Map } | undefined)?.data;
    const meta = this.cache.json.get(BOTS_KEY) as BotsMeta | undefined;
    if (this.failed || !raw || !meta) { this.fail(); return; }
    this.raw = raw;
    this.meta = meta;
    for (const ts of raw.tilesets) if (ts.image) this.load.image(`v2-ts-${ts.name}`, `${V2}${ts.image}`);
    this.load.image(PC_KEY, `${V2}pc.png`);
    this.queueSheet(sheetFor(meta, AVATAR_SHEET, AVATAR_SHEET));
    this.load.once('complete', () => {
      if (this.failed) return;
      try { this.build(); } catch { this.fail(); }
    });
    this.load.start();
  }

  private build(): void {
    this.layout = buildLayout(this.raw);
    this.depths = depthsFor(this.raw);
    this.buildTiles();
    this.buildPcs();
    this.buildDust();
    this.buildAvatar();
    this.bindInput();
    this.buildFps();
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    this.scale.on('resize', () => this.onResize());
    this.ready = true;
    this.applyMode();
    if (this.pendingView) this.sync(this.pendingView);
    this.opts.onReady?.();
  }

  sync(view: WorldView): void {
    if (!this.ready) { this.pendingView = view; return; }
    const seats = resolveSeats(this.layout, view.npcs);
    const live = new Set(view.npcs.map((n) => n.id));
    for (const [id, bot] of this.bots) if (!live.has(id)) this.removeBot(id, bot);
    for (const v of view.npcs) {
      const seat = seats.get(v.id);
      if (seat) this.upsertBot(v, seat);
    }
    if (view.celebrate.length > 0 && view.celebrate !== this.lastCelebrate) for (const id of view.celebrate) this.celebrate(id);
    this.lastCelebrate = view.celebrate;
  }

  setMode(mode: CameraMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.userZoomed = false;
    this.userMoved = false;
    if (this.ready) this.applyMode();
  }

  setRecording(recording: boolean): void {
    this.recording = recording;
    if (this.marker) this.marker.setVisible(false);
    if (this.fpsEl) this.fpsEl.style.display = recording ? 'none' : 'block';
  }

  setSelection(selecting: boolean, ids: string[]): void {
    this.selecting = selecting;
    this.selected = new Set(ids);
  }

  celebrate(id: string): void {
    const b = this.bots.get(id);
    if (!b || !this.ready) return;
    b.jumpAt = this.time.now;
  }

  dispose(): void {
    this.fpsEl?.remove();
    this.fpsEl = null;
  }

  private buildTiles(): void {
    const map = this.make.tilemap({ key: MAP_KEY });
    this.worldW = map.widthInPixels;
    this.worldH = map.heightInPixels;
    const sets: Phaser.Tilemaps.Tileset[] = [];
    for (const ts of this.raw.tilesets) {
      const set = map.addTilesetImage(ts.name, `v2-ts-${ts.name}`);
      if (set) sets.push(set);
    }
    const anims = tileAnimations(this.raw);
    for (const name of V2_TILE_LAYERS) {
      const layer = map.createLayer(name, sets, 0, 0);
      if (!layer) continue;
      layer.setDepth(this.depths.layers[name] ?? 0);
      if (name === 'lights') layer.setBlendMode(Phaser.BlendModes.ADD).setAlpha(LIGHTS_ALPHA);
      layer.forEachTile((tile) => {
        const anim = anims.get(tile.index);
        if (anim) this.animated.push({ tile, anim });
      });
    }
  }

  private buildPcs(): void {
    const meta = this.cache.json.get(PC_KEY) as PcMeta | undefined;
    if (!meta || !this.textures.exists(PC_KEY)) return;
    const tex = this.textures.get(PC_KEY);
    for (const [name, f] of Object.entries(meta.frames)) tex.add(name, 0, f.x, f.y, f.w, f.h);
    for (const o of objects(this.raw)) {
      const p = propsOf(o);
      if (p.kind !== 'pc') continue;
      const t = tileOf(this.raw, o);
      const view = p.view === 'back' ? 'back' : 'front';
      const mapState: PcState = p.state === 'on' ? 'on' : 'off';
      const y = t.y * this.raw.tileheight - PC_LIFT;
      const first = meta.animations?.[pcAnimName(view, mapState)]?.frames[0] ?? `${view}_off`;
      if (!tex.has(first)) continue;
      const img = this.add.image(t.x * this.raw.tilewidth, y, PC_KEY, first).setOrigin(0, 0);
      img.setDepth(charDepth(this.depths, y + img.height - this.raw.tileheight / 2));
      this.pcs.push({ img, view, bot: typeof p.bot === 'string' ? p.bot : null, mapState });
    }
  }

  private tickWorld(now: number): void {
    if (now - this.lastTick < TICK_MS) return;
    this.lastTick = now;
    for (const a of this.animated) {
      const gid = tileAnimFrame(a.anim, now);
      if (a.tile.index !== gid) a.tile.index = gid;
    }
    const meta = this.cache.json.get(PC_KEY) as PcMeta | undefined;
    for (const pc of this.pcs) {
      const owner = pc.bot ? this.bots.get(pc.bot) : undefined;
      const atDesk = !!owner && owner.seat.kind === 'desk' && owner.route.length === 0;
      const state: PcState = pc.bot ? (atDesk ? pcState(owner!.view.mode) : 'off') : pc.mapState;
      const def = meta?.animations?.[pcAnimName(pc.view, state)];
      const frame = def ? frameAt(def.frames, def.fps, now) : undefined;
      if (frame && pc.img.frame.name !== frame && pc.img.texture.has(frame)) pc.img.setFrame(frame);
    }
  }

  private queueSheet(sheet: string): void {
    if (this.sheetState.has(sheet)) return;
    const tex = sheetTexture(sheet);
    if (this.textures.exists(tex)) { this.sheetReady(sheet); return; }
    const def = this.meta.bots[sheet];
    if (!def) { this.sheetState.set(sheet, 'failed'); return; }
    this.sheetState.set(sheet, 'loading');
    this.load.once(`filecomplete-spritesheet-${tex}`, () => this.sheetReady(sheet));
    this.load.on('loaderror', (f: { key?: string }) => { if (f.key === tex) this.sheetState.set(sheet, 'failed'); });
    this.load.spritesheet(tex, `${V2}${def.sheet}`, { frameWidth: this.meta.frame.w, frameHeight: this.meta.frame.h });
  }

  private sheetReady(sheet: string): void {
    this.sheetState.set(sheet, 'ready');
    const tex = sheetTexture(sheet);
    for (const anim of Object.keys(this.meta.animations)) {
      for (const face of this.meta.directions as Face4[]) {
        const key = animKey(sheet, anim, face);
        const f = animFrames(this.meta, anim, face);
        if (!f || this.anims.exists(key)) continue;
        this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex, { start: f.start, end: f.end }), frameRate: f.fps, repeat: -1 });
      }
    }
    for (const b of this.bots.values()) if (b.sheet === sheet) b.sprite.setTexture(tex, 0).setVisible(true);
  }

  private origin(): { x: number; y: number } {
    const f = this.meta.frame;
    return { x: f.origin[0] / f.w, y: f.origin[1] / f.h };
  }

  private play(sprite: Phaser.GameObjects.Sprite, sheet: string, anim: BotAnim, face: Face4): void {
    if (this.sheetState.get(sheet) !== 'ready') return;
    const key = animKey(sheet, anim, face);
    if (this.anims.exists(key)) sprite.play(key, true);
  }

  private makePill(label: string, dot: number | null, badge: string | null): Pill {
    const g = this.add.graphics();
    const text = this.add.text(0, 0, label, { fontFamily: `${FONT}, monospace`, fontSize: '16px', color: '#ffffff' }).setOrigin(0, 0.5);
    const c = this.add.container(0, 0, [g, text]).setDepth(this.depths.labels);
    const pill: Pill = { c, text, g, badge: null, h: 22, w: 0 };
    this.pills.push(pill);
    this.drawPill(pill, label, dot, badge);
    c.setScale(this.labelScale);
    return pill;
  }

  private drawPill(p: Pill, label: string, dot: number | null, badge: string | null): void {
    p.text.setText(label);
    const pad = 6;
    const h = 22;
    const dotW = dot !== null ? 12 : 0;
    if (badge) {
      if (!p.badge) {
        p.badge = this.add.text(0, 0, badge, { fontFamily: `${FONT}, monospace`, fontSize: '16px', color: '#0a0908' }).setOrigin(0.5, 0.5);
        p.c.add(p.badge);
      }
      p.badge.setText(badge);
    } else if (p.badge) {
      p.badge.destroy();
      p.badge = null;
    }
    const badgeW = p.badge ? Math.max(18, p.badge.width + 8) + 4 : 0;
    const w = pad + p.text.width + pad + dotW + badgeW;
    const ox = -Math.round(w / 2);
    p.g.clear();
    p.g.fillStyle(PILL, 0.92).fillRoundedRect(ox, -h, w, h, h / 2);
    p.g.lineStyle(1, PILL_LINE, 1).strokeRoundedRect(ox + 0.5, -h + 0.5, w - 1, h - 1, h / 2);
    let x = ox + pad;
    if (dot !== null) {
      p.g.fillStyle(dot, 1).fillCircle(x + 4, -h / 2, 4);
      p.g.lineStyle(1, 0x000000, 0.5).strokeCircle(x + 4, -h / 2, 4);
      x += dotW;
    }
    p.text.setPosition(x, -h / 2 + 1);
    if (p.badge) {
      const bw = Math.max(18, p.badge.width + 8);
      const bx = x + p.text.width + 4;
      p.g.fillStyle(GREEN, 1).fillRoundedRect(bx, -h + 3, bw, h - 6, (h - 6) / 2);
      p.badge.setPosition(bx + bw / 2, -h / 2 + 1);
    }
    p.h = h;
    p.w = w;
  }

  private applyLabelScale(): void {
    const s = 1 / Math.max(1, this.cameras.main.zoom);
    if (Math.abs(s - this.labelScale) < 0.001) return;
    this.labelScale = s;
    for (const p of this.pills) p.c.setScale(s);
  }

  private headOffset(): number {
    return this.meta.frame.origin[1] + 2;
  }

  private upsertBot(v: NpcView, seat: Seat): void {
    let b = this.bots.get(v.id);
    if (!b) {
      const sheet = sheetFor(this.meta, v.sprite, v.id);
      this.queueSheet(sheet);
      const ready = this.sheetState.get(sheet) === 'ready';
      const o = this.origin();
      const sprite = this.add.sprite(seat.x, seat.y, sheetTexture(ready ? sheet : sheetFor(this.meta, AVATAR_SHEET, AVATAR_SHEET)), 0).setOrigin(o.x, o.y).setVisible(ready);
      const pill = this.makePill(v.name, modeColor(v.mode, v.meeting), v.badge);
      b = { view: v, sprite, pill, sheet, seat, route: [], face: seat.face, jumpAt: -1e9, lift: 0 };
      this.bots.set(v.id, b);
      if (!this.load.isLoading()) this.load.start();
    } else if (b.seat.tile.x !== seat.tile.x || b.seat.tile.y !== seat.tile.y) {
      const from = tileAt(this.raw, b.sprite.x, b.sprite.y - 1);
      b.route = findPathV2(this.raw, this.layout.blocked, from, seat.tile);
    }
    b.view = v;
    b.seat = seat;
    this.drawPill(b.pill, v.name, modeColor(v.mode, v.meeting), v.badge);
  }

  private removeBot(id: string, b: Bot): void {
    this.pills = this.pills.filter((p) => p !== b.pill);
    b.pill.c.destroy();
    b.sprite.destroy();
    this.bots.delete(id);
  }

  private stepBots(dt: number): void {
    const now = this.time.now;
    for (const b of this.bots.values()) {
      const sp = b.sprite;
      const next = b.route[0];
      let anim: BotAnim;
      if (next) {
        const last = b.route.length === 1;
        const t = last ? b.seat : standPoint(this.raw, next);
        const dx = t.x - sp.x;
        const dy = t.y - sp.y;
        const dist = Math.hypot(dx, dy);
        const step = Math.min(dist, (BOT_SPEED * dt) / 1000);
        if (dist <= step + 0.001) { sp.setPosition(t.x, t.y); b.route.shift(); } else { sp.x += (dx / dist) * step; sp.y += (dy / dist) * step; b.face = faceFrom(dx, dy); }
        anim = 'walk';
      } else {
        sp.setPosition(b.seat.x, b.seat.y);
        b.face = b.seat.face;
        anim = botAnim(b.view.mode, b.seat, b.view.moderator === true);
      }
      const jk = (now - b.jumpAt) / JUMP_MS;
      const jumping = jk >= 0 && jk < 1;
      b.lift = jumping ? Math.sin(jk * Math.PI) * JUMP_PX : 0;
      if (jumping) this.play(sp, b.sheet, 'celebrate', 'down');
      else this.play(sp, b.sheet, anim, b.face);
      const o = this.origin();
      sp.setOrigin(o.x, o.y + b.lift / this.meta.frame.h);
      sp.setDepth(charDepth(this.depths, sp.y));
    }
  }

  private layoutPills(): void {
    const head = this.headOffset();
    const boxes = [...this.bots.values()].map((b) => ({
      id: b.view.id, x: b.sprite.x, y: b.sprite.y - head - (b.pill.h * this.labelScale) / 2, w: b.pill.w * this.labelScale, h: b.pill.h * this.labelScale,
    }));
    const lifts = nudgePills(boxes);
    for (const b of this.bots.values()) b.pill.c.setPosition(Math.round(b.sprite.x), Math.round(b.sprite.y - head - b.lift - (lifts.get(b.view.id) ?? 0)));
    this.avatarPill.c.setPosition(Math.round(this.avatar.x), Math.round(this.avatar.y - head));
  }

  private placeRings(): void {
    for (const [id, r] of this.rings) if (!this.selected.has(id) || !this.bots.has(id)) { r.destroy(); this.rings.delete(id); }
    for (const id of this.selected) {
      const b = this.bots.get(id);
      if (!b) continue;
      let r = this.rings.get(id);
      if (!r) { r = this.add.ellipse(0, 0, 24, 10, MEET, 0.35).setStrokeStyle(1, MEET); this.rings.set(id, r); }
      r.setPosition(Math.round(b.sprite.x), Math.round(b.sprite.y) - 1).setDepth(b.sprite.depth - 0.5);
    }
  }

  private buildAvatar(): void {
    const f = standPoint(this.raw, this.layout.spawn);
    const sheet = sheetFor(this.meta, AVATAR_SHEET, AVATAR_SHEET);
    const o = this.origin();
    const tex = sheetTexture(sheet);
    this.avatar = this.add.sprite(f.x, f.y, this.textures.exists(tex) ? tex : '__MISSING', 0).setOrigin(o.x, o.y).setDepth(charDepth(this.depths, f.y));
    this.avatarPill = this.makePill('Deck', GREEN, null);
    this.marker = this.add.ellipse(0, 0, 20, 9, GREEN, 0.5).setStrokeStyle(1, GREEN).setDepth(this.depths.layers.furniture_low! + 0.5).setVisible(false);
  }

  private bindInput(): void {
    const kb = this.input.keyboard;
    if (kb) {
      const k = (c: string): Phaser.Input.Keyboard.Key => kb.addKey(c, false);
      this.keys = { W: k('W'), A: k('A'), S: k('S'), D: k('D'), UP: k('UP'), DOWN: k('DOWN'), LEFT: k('LEFT'), RIGHT: k('RIGHT'), SHIFT: k('SHIFT') };
    }
    this.input.addPointer(1);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.downAt.set(p.id, { x: p.x, y: p.y });
      if (p.rightButtonDown() && this.mode === 'avatar') this.moveTo(p.worldX, p.worldY);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.mode !== 'god' || !p.isDown || p.rightButtonDown() || this.pinching) return;
      const cam = this.cameras.main;
      cam.setScroll(cam.clampX(cam.scrollX - (p.x - p.prevPosition.x) / cam.zoom), cam.clampY(cam.scrollY - (p.y - p.prevPosition.y) / cam.zoom));
      this.userMoved = true;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const d = this.downAt.get(p.id);
      this.downAt.delete(p.id);
      if (!d || this.pinching || p.rightButtonReleased()) return;
      if (Math.hypot(p.x - d.x, p.y - d.y) > 8) return;
      p.updateWorldPoint(this.cameras.main);
      const hit = this.botAt(p.worldX, p.worldY);
      if (hit) { if (this.selecting) this.opts.onToggleBot(hit); else this.opts.onOpenBot(hit); return; }
      if (this.mode === 'avatar') this.moveTo(p.worldX, p.worldY);
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.wheelAcc += dy;
      if (Math.abs(this.wheelAcc) < 40) return;
      const dir = wheelStep(this.wheelAcc);
      this.wheelAcc = 0;
      this.stepCameraZoom(dir);
    });
  }

  private stepCameraZoom(dir: number): void {
    const cam = this.cameras.main;
    const z = stepZoomV2(cam.zoom, dir);
    if (z === cam.zoom) return;
    this.userZoomed = true;
    cam.setZoom(z);
    if (this.mode === 'god') cam.setScroll(cam.clampX(cam.scrollX), cam.clampY(cam.scrollY));
    this.applyLabelScale();
  }

  private botAt(wx: number, wy: number): string | null {
    const halfW = this.meta.frame.w / 2 - 4;
    const top = this.meta.frame.origin[1];
    let best: string | null = null;
    let bestD = Infinity;
    for (const [id, b] of this.bots) {
      const x = b.sprite.x;
      const y = b.sprite.y;
      if (Math.abs(wx - x) > halfW || wy < y - top || wy > y + 4) continue;
      const d = Math.hypot(wx - x, wy - (y - top / 2));
      if (d < bestD) { best = id; bestD = d; }
    }
    return best;
  }

  private moveTo(wx: number, wy: number): void {
    const from = tileAt(this.raw, this.avatar.x, this.avatar.y - 1);
    const reach = this.layout.reach;
    const wanted = tileAt(this.raw, wx, wy);
    const to = reach.has(wanted.y * this.raw.width + wanted.x) ? wanted : nearestReachable(this.raw, reach, wanted);
    if (!to) return;
    const path = findPathV2(this.raw, this.layout.blocked, from, to);
    if (path.length === 0) return;
    this.route = [from, ...path];
    const end = standPoint(this.raw, to);
    if (!this.recording) this.marker.setPosition(end.x, end.y - 2).setVisible(true);
  }

  private stick = { x: 0, y: 0 };
  private stickDriven = false;

  setStick(x: number, y: number): void {
    const len = Math.hypot(x, y);
    const k = len > 1 ? 1 / len : 1;
    this.stick = { x: x * k, y: y * k };
  }

  private keyAxis(): { vx: number; vy: number } {
    const k = this.keys;
    if (!k || isTypingTarget(document.activeElement as HTMLElement | null)) return { vx: 0, vy: 0 };
    const kx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const ky = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    this.stickDriven = false;
    if (kx === 0 && ky === 0 && (this.stick.x !== 0 || this.stick.y !== 0)) { this.stickDriven = true; return { vx: this.stick.x, vy: this.stick.y }; }
    return {
      vx: (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0),
      vy: (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0),
    };
  }

  private stepAvatar(dt: number): void {
    const a = this.avatar;
    const sheet = sheetFor(this.meta, AVATAR_SHEET, AVATAR_SHEET);
    let { vx, vy } = this.mode === 'avatar' ? this.keyAxis() : { vx: 0, vy: 0 };
    const keyed = vx !== 0 || vy !== 0;
        const running = keyed && ((!!this.keys?.SHIFT.isDown && !isTypingTarget(document.activeElement as HTMLElement | null)) || (this.stickDriven && stickRuns(Math.hypot(this.stick.x, this.stick.y))));
    const step = (runSpeed(AVATAR_SPEED, running) * dt) / 1000;
    let routed = false;
    if (vx !== 0 || vy !== 0) {
      this.route = [];
      this.marker.setVisible(false);
    } else if (this.route.length > 0) {
      const t = standPoint(this.raw, this.route[0]!);
      const dx = t.x - a.x;
      const dy = t.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= Math.max(1, step)) {
        a.setPosition(t.x, t.y);
        this.route.shift();
        if (this.route.length === 0) this.marker.setVisible(false);
      } else { vx = dx / dist; vy = dy / dist; routed = true; }
    }
    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      const nx = a.x + (vx / len) * step;
      const ny = a.y + (vy / len) * step;
      const px = a.x;
      const py = a.y;
      if (routed) { a.x = nx; a.y = ny; } else {
        if (!boxBlocked(this.raw, this.layout.blocked, nx, a.y, FOOT_HALF_W, FOOT_H)) a.x = nx;
        if (!boxBlocked(this.raw, this.layout.blocked, a.x, ny, FOOT_HALF_W, FOOT_H)) a.y = ny;
      }
      this.avatarFace = faceFrom(vx, vy);
      const moved = a.x !== px || a.y !== py;
      const gait = gaitAnim(this.meta, running);
      this.play(a, sheet, moved ? gait.anim : 'idle', this.avatarFace);
      a.anims.timeScale = moved ? gait.scale : 1;
      const dusty = dustAllowed(surfaceOfProps(groundProps(this.raw, a.x, a.y - 1)));
      const t = dustTick(this.dustAcc, dt, running && moved && dusty);
      this.dustAcc = t.acc;
      for (let i = 0; i < t.count; i++) this.puff(a.x, a.y, vx / len, vy / len);
      this.lookDir = running && moved ? { x: vx / len, y: vy / len } : { x: 0, y: 0 };
    } else {
      a.anims.timeScale = 1;
      this.dustAcc = 0;
      this.lookDir = { x: 0, y: 0 };
      this.play(a, sheet, 'idle', this.avatarFace);
    }
    a.setDepth(charDepth(this.depths, a.y));
  }

  private stepLook(dt: number): void {
    if (this.mode !== 'avatar') return;
    this.look = lookahead(this.look, this.lookDir.x, this.lookDir.y, dt);
    this.cameras.main.setFollowOffset(-this.look.x, -this.look.y);
  }

  private onResize(): void {
    if (!this.ready) return;
    const cam = this.cameras.main;
    if (!this.userZoomed) cam.setZoom(this.defaultZoom());
    if (this.mode === 'god') {
      if (this.userMoved) cam.setScroll(cam.clampX(cam.scrollX), cam.clampY(cam.scrollY));
      else this.centerGod();
    }
    this.applyLabelScale();
  }

  private defaultZoom(): number {
    const cam = this.cameras.main;
    if (this.mode === 'god') return fitZoomV2(cam.width, cam.height, this.worldW, this.worldH);
    return pickZoom(cam.width, cam.height, this.raw.tilewidth);
  }

  private centerGod(): void {
    const c = standPoint(this.raw, this.layout.center);
    this.cameras.main.centerOn(c.x, c.y);
  }

  private applyMode(): void {
    const cam = this.cameras.main;
    cam.setZoom(this.defaultZoom());
    if (this.mode === 'god') {
      cam.stopFollow();
      this.route = [];
      this.marker.setVisible(false);
      this.centerGod();
      const focus = parseFocus(location.search);
      const house = focus ? objects(this.raw).find((o) => !o.point && propsOf(o).id === focus.house) : undefined;
      if (focus && house) {
        const r = rectOf(this.raw, house);
        cam.setZoom(stepZoomV2(focus.zoom, 0));
        cam.centerOn((r.x + r.w / 2) * this.raw.tilewidth, (r.y + r.h / 2) * this.raw.tileheight);
        this.userMoved = true;
        this.userZoomed = true;
      }
    } else {
      cam.startFollow(this.avatar, true, 0.15, 0.15);
    }
    this.applyLabelScale();
  }

  private buildFps(): void {
    if (new URLSearchParams(location.search).get('fps') !== '1') return;
    const el = document.createElement('div');
    el.setAttribute('data-world-fps', '');
    el.style.cssText = 'position:absolute;right:8px;bottom:8px;z-index:5;padding:2px 6px;border-radius:4px;background:rgba(10,9,8,.75);color:#3fd17f;font:11px monospace;pointer-events:none';
    el.textContent = '-- fps';
    this.opts.parent.appendChild(el);
    this.fpsEl = el;
    this.fpsSince = performance.now();
  }

  private stepFps(): void {
    if (!this.fpsEl) return;
    this.fpsFrames++;
    const now = performance.now();
    const span = now - this.fpsSince;
    if (span < 500) return;
    this.fpsEl.textContent = `${Math.round((this.fpsFrames * 1000) / span)} fps`;
    this.fpsFrames = 0;
    this.fpsSince = now;
  }

  update(time: number, dt: number): void {
    this.stepLook(dt);
    if (!this.ready) return;
    this.stepAvatar(dt);
    this.stepBots(dt);
    this.tickWorld(time);
    this.applyLabelScale();
    this.layoutPills();
    this.placeRings();
    this.pinch();
    this.stepFps();
  }

  private pinch(): void {
    const { pointer1: p1, pointer2: p2 } = this.input;
    if (p1.isDown && p2.isDown) {
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      this.pinching = true;
      if (this.pinchDist > 0) {
        this.pinchRatio *= d / this.pinchDist;
        if (this.pinchRatio > 1.3) { this.stepCameraZoom(1); this.pinchRatio = 1; }
        else if (this.pinchRatio < 0.77) { this.stepCameraZoom(-1); this.pinchRatio = 1; }
      }
      this.pinchDist = d;
    } else {
      this.pinchDist = 0;
      this.pinchRatio = 1;
      if (!p1.isDown && !p2.isDown) this.pinching = false;
    }
  }
}

export function createWorldV2(opts: WorldOptions & { onError?: () => void }): WorldHandle {
  const scene = new WorldSceneV2(opts);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: opts.parent,
    backgroundColor: '#0a0908',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    banner: false,
    disableContextMenu: true,
    scale: { mode: Phaser.Scale.RESIZE, width: opts.parent.clientWidth || 800, height: opts.parent.clientHeight || 600 },
    input: { activePointers: 2 },
    scene,
  });
  return {
    update: (view) => scene.sync(view),
    setMode: (m) => scene.setMode(m),
    setRecording: (r) => scene.setRecording(r),
    setSelection: (s, ids) => scene.setSelection(s, ids),
    celebrate: (id) => scene.celebrate(id),
    setStick: (x, y) => scene.setStick(x, y),
    refresh: () => game.scale.refresh(),
    destroy: () => { scene.dispose(); game.destroy(true); },
  };
}
