import Phaser from 'phaser';
import {
  AVATAR_SPAWN, FLOWER_BEDS, HOUSES, MAP_H, MAP_W, PLAZA, ROAD, STREET, TILE, TREES, WORLD,
  doorTiles, findPath, parseColor, inf, isBlocked, tf, tileCenter, toTile, type Face, type HouseDef, type Point, type Sheet,
} from './world-map';
import { assignSpots, type Spot } from './world-layout';
import { nudgePills } from './pill-layout';
import { clampZoom, initialZoom, parseFocus, stepZoom, wheelStep, type CameraMode } from './camera-mode';
import { sheetFrame, spriteKey, spritePath, textureKey } from './bot-sprite';
import { npcSprite, type Flight, type NpcView, type WorldView } from './world-state';
import { pickWanderTile, tileKey, wanderDelay, wanderTiles } from './world-wander';
import { planCarry } from './world-carry';
import { ParticleSim, jumpLift, stepPhase, walkBob, type Particle } from './world-juice';

// Phaser lives only in this module, loaded with a dynamic import from TeamWorld.tsx.
// Art: Kenney CC0 sheets and font in /world (see LICENSES.md). 16px tiles, whole zoom only.

const BASE = import.meta.env.BASE_URL;
const FONT = 'KenneyMini';

const F = {
  flowerB: tf(2, 0), treeTop: tf(4, 0), treeBase: tf(4, 1), autumnTop: tf(3, 0), autumnBase: tf(3, 1), bush: tf(5, 0),
  potion: tf(8, 9),
};
const TILESETS = ['town', 'dungeon', 'indoor', 'urban', 'props'] as const;
const DOOR_TINT = 0xb59a74;
const SIDEWALK_TINT = 0xd9d3c6;
// Decor tiles pick their depth from the tile property `layer`; "top" sits on a desk, drawn 4px up.
const DECOR = { floor: { depth: 3, dy: 0 }, wall: { depth: 4, dy: 0 }, top: { depth: 7, dy: -4 }, other: { depth: 6, dy: 0 } } as const;
type DecorGroup = keyof typeof DECOR;

// Office people from the RPG Urban Pack: 6 characters x (idle, walk A, walk B) rows, 4 facing columns.
const FACE_COL: Record<Face, number> = { left: 23, down: 24, up: 25, right: 26 };
const charFrame = (k: number, row: number, face: Face): number => inf(FACE_COL[face], k * 3 + row);
const NPC_CHARS = [0, 1, 2, 4, 5];
const NPC_TINTS = [0xffffff, 0xd2e4ff, 0xffe2cc];
const AVATAR_CHAR = 3;
const WALK_SPEED = 46;

const GREEN = 0x3fd17f;
const GREY = 0x8d8a85;
const AMBER = 0xf5a524;
const MEET = 0xa78bfa;
const INK = 0x0a0908;
const PILL = 0x14110f;
const PILL_LINE = 0x39342e;
const AVATAR_SPEED = 72;
const FOCUS_W = (PLAZA.x1 - PLAZA.x0 + 3) * TILE;

const modeColor = (m: NpcView['mode'], meeting = false): number => (meeting ? MEET : m === 'working' ? GREEN : m === 'waiting' ? AMBER : GREY);

export async function loadWorldFont(): Promise<void> {
  if (typeof FontFace === 'undefined') return;
  const face = new FontFace(FONT, `url(${BASE}world/kenney-mini-square.ttf)`);
  await face.load();
  document.fonts.add(face);
}

export interface WorldOptions {
  parent: HTMLElement;
  mode: CameraMode;
  coarse: boolean;
  onOpenBot: (id: string) => void;
  onToggleBot: (id: string) => void;
  onReady?: () => void;
}

export interface WorldHandle {
  update: (view: WorldView) => void;
  setMode: (mode: CameraMode) => void;
  setRecording: (recording: boolean) => void;
  setSelection: (selecting: boolean, ids: string[]) => void;
  celebrate: (id: string) => void;
  refresh: () => void;
  destroy: () => void;
}

// A dark rounded pill: optional icon, white pixel text, optional state dot and count badge.
interface Pill {
  c: Phaser.GameObjects.Container;
  text: Phaser.GameObjects.Text;
  g: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image | null;
  badge: Phaser.GameObjects.Text | null;
  anchor: 'center' | 'left';
  h: number;
  w: number;
}

interface Npc {
  view: NpcView;
  sprite: Phaser.GameObjects.Sprite;
  pill: Pill;
  extras: Phaser.GameObjects.GameObject[];
  tweens: Phaser.Tweens.Tween[];
  mode: NpcView['mode'] | null;
  spot: Spot;
  index: number;
  busyUntil: number;
  route: Point[];
  walking: boolean;
  char: number;
  own: string | null;
  tint: number;
  face: Face;
  shadow: Phaser.GameObjects.Image;
  // A tile the bot walked to on its own (wander or handover); wins over spot.tile until the spot changes.
  stand: Point | null;
  nextWander: number;
  wanderN: number;
  phase: number;
  dust: number;
  lift: number;
  jumpAt: number;
  carry: Carry | null;
}

interface Carry { phase: 'go' | 'back'; receiver: string; box: Phaser.GameObjects.Image; prevStand: Point | null }

const JUMP_MS = 760;
const SPARK_TINTS = [0x3fd17f, 0xffd166, 0xffffff, 0xb69cff];

// Multiply each RGB channel, for the alternate tiles of a checker floor.
const shade = (c: number, k: number): number => ((((c >> 16) & 255) * k) << 16) | ((((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);

const hash = (x: number, y: number): number => Math.abs((x * 73856093) ^ (y * 19349663)) % 100;

class WorldScene extends Phaser.Scene {
  private readonly opts: WorldOptions;
  private mode: CameraMode;
  private recording = false;
  private ready = false;
  private pendingView: WorldView | null = null;
  private npcs = new Map<string, Npc>();
  private seenFlights = new Set<string>();
  private pills: Pill[] = [];
  private housePills = new Map<string, Pill>();
  private labelScale = 1;
  private avatar!: Phaser.GameObjects.Sprite;
  private avatarPill!: Pill;
  private route: Point[] = [];
  private avatarFace: Face = 'down';
  private marker!: Phaser.GameObjects.Ellipse;
  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', Phaser.Input.Keyboard.Key>;
  private downAt = new Map<number, Point>();
  private pinchDist = 0;
  private pinchRatio = 1;
  private wheelAcc = 0;
  private pinching = false;
  private userMoved = false;
  private selecting = false;
  private selected = new Set<string>();
  private rings = new Map<string, Phaser.GameObjects.Ellipse>();
  private sim = new ParticleSim();
  private fx: Phaser.GameObjects.Image[] = [];
  private wanderPool: Point[] = [];
  private lastCelebrate: string[] | null = null;

  constructor(opts: WorldOptions) {
    super('world');
    this.opts = opts;
    this.mode = opts.mode;
  }

  private sheetState = new Map<string, 'loading' | 'ready' | 'failed'>();

  private ensureSheet(key: string): void {
    if (this.sheetState.has(key)) return;
    const tex = textureKey(key);
    if (this.textures.exists(tex)) { this.sheetState.set(key, 'ready'); return; }
    this.sheetState.set(key, 'loading');
    const onOk = (k: string): void => {
      if (k !== tex) return;
      this.sheetState.set(key, 'ready');
      for (const n of this.npcs.values()) if (n.own === key) n.sprite.setTexture(tex, this.frameOf(n, 0)).clearTint();
    };
    this.load.once(`filecomplete-spritesheet-${tex}`, () => onOk(tex));
    this.load.once('loaderror', (f: { key?: string }) => { if (f.key === tex) this.sheetState.set(key, 'failed'); });
    this.load.spritesheet(tex, spritePath(BASE, key), { frameWidth: TILE, frameHeight: TILE });
    this.load.start();
  }

  private ownReady(n: Pick<Npc, 'own'>): boolean {
    return !!n.own && this.sheetState.get(n.own) === 'ready';
  }

  private frameOf(n: Npc, row: number): number {
    return this.ownReady(n) ? sheetFrame(row, n.face) : charFrame(n.char, row, n.face);
  }

  preload(): void {
    const sheet = { frameWidth: TILE, frameHeight: TILE };
    this.load.spritesheet('town', `${BASE}world/town.png`, sheet);
    this.load.spritesheet('dungeon', `${BASE}world/dungeon.png`, sheet);
    this.load.spritesheet('urban', `${BASE}world/urban.png`, sheet);
    this.load.spritesheet('props', `${BASE}world/props.png`, sheet);
    this.load.spritesheet('indoor', `${BASE}world/indoor.png`, { ...sheet, spacing: 1 });
    this.load.tilemapTiledJSON('world', `${BASE}world/world.tmj`);
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor(INK);
    cam.roundPixels = true;
    this.makeGlow();
    this.makeTextures();
    this.wanderPool = wanderTiles();
    this.buildTiles();
    this.buildStreet();
    this.buildPlaza();
    for (const h of HOUSES) this.buildHouse(h);
    this.buildTrees();
    this.buildAvatar();
    this.buildParticles();
    this.bindInput();
    this.scale.on('resize', () => { if (this.mode === 'god' && !this.userMoved) this.applyMode(false); });
    this.ready = true;
    this.applyMode(false);
    this.applyLabelScale(true);
    if (this.pendingView) this.sync(this.pendingView);
    this.opts.onReady?.();
  }

  // ---- public ----

  sync(view: WorldView): void {
    if (!this.ready) { this.pendingView = view; return; }
    for (const h of HOUSES) {
      const meet = h.id === 'sala' && view.meetingSize > 0;
      const p = this.housePills.get(h.id)!;
      this.drawPill(p, p.text.text, meet ? MEET : null, meet ? 'em reunião' : (view.projects[h.id] ?? null));
    }
    const spots = assignSpots(view.npcs);
    const live = new Set(view.npcs.map((n) => n.id));
    for (const [id, npc] of this.npcs) if (!live.has(id)) this.removeNpc(id, npc);
    view.npcs.forEach((v, i) => this.upsertNpc(v, spots.get(v.id)!, i));
    for (const f of view.flights) {
      if (this.seenFlights.has(f.key)) continue;
      this.seenFlights.add(f.key);
      if (!this.startCarry(f)) this.fly(f);
    }
    if (view.celebrate.length > 0 && view.celebrate !== this.lastCelebrate) for (const id of view.celebrate) this.celebrate(id);
    this.lastCelebrate = view.celebrate;
    if (this.seenFlights.size > 200) this.seenFlights = new Set([...this.seenFlights].slice(-100));
  }

  setMode(mode: CameraMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.userMoved = false;
    if (this.ready) this.applyMode(true);
  }

  setRecording(recording: boolean): void {
    this.recording = recording;
    if (this.marker) this.marker.setVisible(false);
  }

  celebrate(id: string): void {
    const n = this.npcs.get(id);
    if (!n || !this.ready) return;
    n.jumpAt = this.time.now;
    const burst = (count: number): void => {
      if (!this.npcs.has(id)) return;
      for (let i = 0; i < count; i++) {
        const a = -Math.PI / 2 + (i / count - 0.5) * Math.PI * 1.6;
        const v = 28 + ((i * 37) % 22);
        this.emit('spark', n.sprite.x, n.sprite.y - 12 - n.lift, Math.cos(a) * v, Math.sin(a) * v - 10, 650);
      }
    };
    burst(12);
    this.time.delayedCall(JUMP_MS / 2, () => burst(6));
  }

  setSelection(selecting: boolean, ids: string[]): void {
    this.selecting = selecting;
    this.selected = new Set(ids);
  }

  // ---- map ----

  private img(sheet: Sheet, frame: number, tx: number, ty: number, depth: number, tint?: number): Phaser.GameObjects.Image {
    const i = this.add.image(tx * TILE, ty * TILE, sheet, frame).setOrigin(0, 0).setDepth(depth);
    if (tint !== undefined) i.setTint(tint);
    return i;
  }

  private rect(x: number, y: number, w: number, h: number, color: number, alpha: number, depth: number): Phaser.GameObjects.Rectangle {
    return this.add.rectangle(x, y, w, h, color, alpha).setOrigin(0, 0).setDepth(depth);
  }

  // Stepped (pixel) radial light, drawn once and reused as an additive sprite.
  private makeGlow(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    for (const [r, a] of [[30, 0.03], [23, 0.04], [16, 0.06], [9, 0.09]] as const) { g.fillStyle(0xffffff, a); g.fillCircle(32, 32, r); }
    g.generateTexture('glow', 64, 64);
    g.destroy();
  }

  // Small code-made textures: handover box, soft shadow, dust puff, star spark.
  private makeTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x8a5a2b, 1).fillRect(0, 1, 8, 6);
    g.fillStyle(0xb98245, 1).fillRect(0, 1, 8, 2);
    g.fillStyle(0xf2ead8, 1).fillRect(3, 1, 2, 6);
    g.lineStyle(1, 0x2f1d0e, 1).strokeRect(0.5, 1.5, 7, 5);
    g.generateTexture('box', 8, 8);
    g.clear();
    g.fillStyle(0x000000, 0.18).fillEllipse(8, 3, 16, 6);
    g.fillStyle(0x000000, 0.22).fillEllipse(8, 3, 11, 4);
    g.generateTexture('shadow', 16, 6);
    g.clear();
    g.fillStyle(0xe8dcc4, 0.35).fillCircle(4, 4, 4);
    g.fillStyle(0xe8dcc4, 0.5).fillCircle(4, 4, 2);
    g.generateTexture('dust', 8, 8);
    g.clear();
    g.fillStyle(0xffffff, 1).fillRect(3, 0, 1, 7).fillRect(0, 3, 7, 1).fillRect(2, 2, 3, 3);
    g.generateTexture('spark', 7, 7);
    g.destroy();
  }

  private buildParticles(): void {
    for (let i = 0; i < this.sim.cap; i++) this.fx.push(this.add.image(0, 0, 'dust').setDepth(9_500).setVisible(false));
  }

  private emit(kind: Particle['kind'], x: number, y: number, vx: number, vy: number, life: number): void {
    this.sim.spawn(kind, x, y, vx, vy, life);
  }

  private renderParticles(dt: number): void {
    this.sim.step(dt);
    for (const p of this.sim.particles) {
      const img = this.fx[p.slot]!;
      if (!p.alive) { if (img.visible) img.setVisible(false); continue; }
      const k = p.age / p.life;
      if (img.texture.key !== p.kind) img.setTexture(p.kind);
      img.setVisible(true).setPosition(Math.round(p.x), Math.round(p.y)).setAlpha(1 - k);
      if (p.kind === 'dust') img.setScale(0.5 + k * 0.7).clearTint();
      else img.setScale(1 - k * 0.5).setTint(SPARK_TINTS[p.slot % SPARK_TINTS.length]!);
    }
  }

  private glowAt(x: number, y: number, k: number, tint = 0xffb347): void {
    const s = this.add.image(x, y, 'glow').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(8).setAlpha(0.6 * k).setScale(k);
    this.tweens.add({ targets: s, alpha: 0.4 * k, duration: 1600 + ((x * 7 + y * 3) % 900), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private buildTiles(): void {
    const map = this.make.tilemap({ key: 'world' });
    const sets = TILESETS.map((n) => map.addTilesetImage(n, n)!);
    const props = (index: number): Record<string, unknown> => (map.tilesets.find((t) => t.containsTileIndex(index))?.getTileProperties(index) as Record<string, unknown> | undefined) ?? {};
    const ground = map.createLayer('ground', sets, 0, 0)!.setDepth(0);
    this.tintGround(ground, props);
    map.createLayer('walls', sets, 0, 0)!.setDepth(5);
    map.createLayer('furniture', sets, 0, 0)!.setDepth(6);
    this.buildDecor(map, sets, props);
    for (const name of ['walls', 'furniture']) {
      for (const row of map.getLayer(name)!.data) {
        for (const t of row) {
          if (t.index < 0) continue;
          const p = props(t.index);
          if (name === 'furniture' && p.block) this.rect(t.x * TILE + 1, (t.y + 1) * TILE, 14, 3, INK, 0.3, 5);
          this.tileEffects(p, t.x, t.y, 0);
        }
      }
    }
  }

  // The decor layer is split by the `layer` tile property into one blank layer per depth group.
  private buildDecor(map: Phaser.Tilemaps.Tilemap, sets: Phaser.Tilemaps.Tileset[], props: (i: number) => Record<string, unknown>): void {
    const groups = new Map<DecorGroup, Phaser.Tilemaps.TilemapLayer>();
    for (const row of map.getLayer('decor')!.data) {
      for (const t of row) {
        if (t.index < 0) continue;
        const p = props(t.index);
        const g: DecorGroup = p.layer === 'floor' || p.layer === 'wall' || p.layer === 'top' ? p.layer : 'other';
        let layer = groups.get(g);
        if (!layer) {
          layer = map.createBlankLayer(`decor-${g}`, sets, 0, DECOR[g].dy, map.width, map.height)!.setDepth(DECOR[g].depth);
          groups.set(g, layer);
        }
        layer.putTileAt(t.index, t.x, t.y);
        this.tileEffects(p, t.x, t.y, DECOR[g].dy);
      }
    }
  }

  // Tile properties `glow` (warm lamp) and `screen` (animated monitor).
  private tileEffects(p: Record<string, unknown>, x: number, y: number, dy: number): void {
    if (p.glow) this.glowAt(x * TILE + 8, y * TILE + 6 + dy, 1);
    if (!p.screen) return;
    const on = this.add.rectangle(x * TILE + 4, y * TILE + 5 + dy, 8, 5, hash(x, y) % 2 === 0 ? 0x7fd0ff : 0x9cffc0, 0.55).setOrigin(0, 0).setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: on, alpha: 0.35, duration: 900 + hash(x, y) * 8, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.glowAt(x * TILE + 8, y * TILE + 8 + dy, 0.35, 0x7fd0ff);
  }

  // Floor tiles (tile property `floor`) take their tint from the zone they sit in: plaza, street, house interior, doors.
  private tintGround(ground: Phaser.Tilemaps.TilemapLayer, props: (i: number) => Record<string, unknown>): void {
    const inside = (r: { x0: number; x1: number; y0: number; y1: number }, x: number, y: number): boolean => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
    const doors = new Set<string>();
    const outside = new Set<string>();
    for (const h of HOUSES) {
      for (const d of doorTiles(h)) {
        doors.add(`${d.x},${d.y}`);
        const o = h.door === 'east' ? { x: d.x + 1, y: d.y } : h.door === 'west' ? { x: d.x - 1, y: d.y } : { x: d.x, y: d.y + 1 };
        outside.add(`${o.x},${o.y}`);
      }
    }
    ground.forEachTile((t) => {
      if (t.index < 0) return;
      const p = props(t.index);
      if (typeof p.tint === 'string') { t.tint = parseColor(p.tint) ?? 0xffffff; return; }
      if (!p.floor) return;
      const k = `${t.x},${t.y}`;
      const house = HOUSES.find((h) => t.x > h.x && t.x < h.x + h.w - 1 && t.y > h.y && t.y < h.y + h.h - 1);
      if (doors.has(k)) t.tint = DOOR_TINT;
      else if (outside.has(k)) t.tint = SIDEWALK_TINT;
      else if (house) t.tint = (t.x + t.y) % 2 === 0 ? house.tint : shade(house.tint, 0.93);
      else if (inside(PLAZA, t.x, t.y)) t.tint = (t.x + t.y) % 2 === 0 ? PLAZA.tint : PLAZA.tint2;
      else if (inside(STREET, t.x, t.y)) t.tint = STREET.tint;
    });
  }

  private buildStreet(): void {
    for (let x = STREET.x0; x <= STREET.x1; x++) {
      if (x % 2 === 0) this.rect(x * TILE + 3, (ROAD.y0 + 1) * TILE - 1, 10, 2, 0xf2ead8, 0.65, 2);
    }
    // Curbs and sidewalk edges.
    this.rect(STREET.x0 * TILE, ROAD.y0 * TILE - 1, (STREET.x1 - STREET.x0 + 1) * TILE, 2, 0x2f2a25, 0.9, 2);
    this.rect(STREET.x0 * TILE, (ROAD.y1 + 1) * TILE - 1, (STREET.x1 - STREET.x0 + 1) * TILE, 2, 0x2f2a25, 0.9, 2);
    for (const sign of WORLD.signs) {
      const pill = this.makePill({ text: sign.label, anchor: 'left', dot: null, icon: null });
      pill.c.setPosition(sign.x * TILE, sign.y * TILE - 2);
    }
  }

  private buildPlaza(): void {
    const w = (PLAZA.x1 - PLAZA.x0 + 1) * TILE;
    const h = (PLAZA.y1 - PLAZA.y0 + 1) * TILE;
    this.add.rectangle(PLAZA.x0 * TILE, PLAZA.y0 * TILE, w, h).setOrigin(0, 0).setStrokeStyle(1, 0x2f2a25, 0.8).setDepth(2);
    const tints = [0xff7a90, 0xffd166, 0xb69cff, 0xffffff];
    for (const bed of FLOWER_BEDS) {
      this.rect(bed.x * TILE - 1, bed.y * TILE - 1, bed.w * TILE + 2, bed.h * TILE + 2, 0x5b3a22, 1, 1);
      for (let x = 0; x < bed.w; x++) {
        for (let y = 0; y < bed.h; y++) this.img('town', F.flowerB, bed.x + x, bed.y + y, 2, tints[(x * 3 + y * 5 + bed.x) % tints.length]);
      }
    }
  }

  private buildHouse(h: HouseDef): void {
    // Depth: shade under the back wall, along the side walls and below the house.
    this.rect((h.x + 1) * TILE, (h.y + 1) * TILE, (h.w - 2) * TILE, 6, INK, 0.2, 3);
    this.rect((h.x + 1) * TILE, (h.y + 1) * TILE, 3, (h.h - 2) * TILE, INK, 0.12, 3);
    this.rect((h.x + h.w - 1) * TILE - 3, (h.y + 1) * TILE, 3, (h.h - 2) * TILE, INK, 0.12, 3);
    this.rect(h.x * TILE, (h.y + h.h) * TILE, h.w * TILE, 4, INK, 0.25, 1);
    const pill = this.makePill({ text: h.label, anchor: 'center', dot: null, icon: h.icon });
    pill.c.setPosition((h.x + h.w / 2) * TILE, h.y * TILE - 3);
    this.housePills.set(h.id, pill);
  }

  private buildTrees(): void {
    for (const t of TREES) {
      const yPx = (t.y + 1) * TILE;
      this.add.ellipse(t.x * TILE + 8, yPx - 2, 14, 5, INK, 0.28).setDepth(5);
      if (t.kind === 'bush') { this.add.image(t.x * TILE, t.y * TILE, 'town', F.bush).setOrigin(0, 0).setDepth(100 + yPx); continue; }
      const autumn = t.kind === 'autumn';
      this.add.image(t.x * TILE, (t.y - 1) * TILE, 'town', autumn ? F.autumnTop : F.treeTop).setOrigin(0, 0).setDepth(100 + yPx);
      this.add.image(t.x * TILE, t.y * TILE, 'town', autumn ? F.autumnBase : F.treeBase).setOrigin(0, 0).setDepth(100 + yPx);
    }
  }

  // ---- pills ----

  private makePill(o: { text: string; anchor: 'center' | 'left'; dot: number | null; icon: { s: Sheet; f: number } | null; badge?: string | null }): Pill {
    const g = this.add.graphics();
    const text = this.add.text(0, 0, o.text, { fontFamily: `${FONT}, monospace`, fontSize: '16px', color: '#ffffff' }).setOrigin(0, 0.5);
    const icon = o.icon ? this.add.image(0, 0, o.icon.s, o.icon.f).setOrigin(0, 0.5) : null;
    const c = this.add.container(0, 0, [g, ...(icon ? [icon] : []), text]).setDepth(10_000);
    const pill: Pill = { c, text, g, icon, badge: null, anchor: o.anchor, h: 22, w: 0 };
    this.pills.push(pill);
    this.drawPill(pill, o.text, o.dot, o.badge ?? null);
    c.setScale(this.labelScale);
    return pill;
  }

  private drawPill(p: Pill, label: string, dot: number | null, badge: string | null): void {
    p.text.setText(label);
    const pad = 6;
    const h = 22;
    let w = pad + p.text.width + pad;
    const iconW = p.icon ? 18 : 0;
    const dotW = dot !== null ? 12 : 0;
    w += iconW + dotW;
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
    w += badgeW;
    const ox = p.anchor === 'center' ? -Math.round(w / 2) : 0;
    p.g.clear();
    p.g.fillStyle(PILL, 0.92).fillRoundedRect(ox, -h, w, h, h / 2);
    p.g.lineStyle(1, PILL_LINE, 1).strokeRoundedRect(ox + 0.5, -h + 0.5, w - 1, h - 1, h / 2);
    let x = ox + pad;
    if (p.icon) { p.icon.setPosition(x, -h / 2); x += iconW; }
    if (dot !== null) { p.g.fillStyle(dot, 1).fillCircle(x + 4, -h / 2, 4); p.g.lineStyle(1, 0x000000, 0.5).strokeCircle(x + 4, -h / 2, 4); x += dotW; }
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

  private setPillBadge(p: Pill, badge: string | null): void {
    this.drawPill(p, p.text.text, null, badge);
  }

  // Pills are drawn at 1 screen px per font px: scale = 1 / zoom (zoom is whole).
  private applyLabelScale(force = false): void {
    const z = this.cameras.main.zoom;
    // At 1x a 16px pill would swamp 16px characters: the font is drawn at half size (8px grid, still whole).
    const s = z <= 1 ? 0.5 : 1 / z;
    if (!force && Math.abs(s - this.labelScale) < 0.001) return;
    this.labelScale = s;
    for (const p of this.pills) p.c.setScale(s);
  }

  // ---- NPCs ----

  private feet(p: Point): { x: number; y: number } {
    return { x: tileCenter(p.x), y: (p.y + 1) * TILE - 1 };
  }

  private upsertNpc(v: NpcView, spot: Spot, index: number): void {
    let npc = this.npcs.get(v.id);
    const f = this.feet(spot.tile);
    if (!npc) {
      const char = NPC_CHARS[index % NPC_CHARS.length]!;
      const tint = NPC_TINTS[Math.floor(index / NPC_CHARS.length) % NPC_TINTS.length]!;
      const own = spriteKey(v.sprite);
      if (own) this.ensureSheet(own);
      const ready = !!own && this.sheetState.get(own) === 'ready';
      const sprite = ready
        ? this.add.sprite(f.x, f.y, textureKey(own!), sheetFrame(0, spot.face)).setOrigin(0.5, 1)
        : this.add.sprite(f.x, f.y, 'urban', charFrame(char, 0, spot.face)).setOrigin(0.5, 1).setTint(tint);
      const pill = this.makePill({ text: v.name, anchor: 'center', dot: modeColor(v.mode, v.meeting), icon: null, badge: v.badge });
      const shadow = this.add.image(f.x, f.y - 1, 'shadow').setDepth(100 + f.y - 0.5);
      npc = {
        view: v, sprite, pill, extras: [], tweens: [], mode: null, spot, index, busyUntil: 0, route: [], walking: false, char, own, tint, face: spot.face,
        shadow, stand: null, nextWander: this.time.now + wanderDelay(v.id, 0), wanderN: 0, phase: 0, dust: 0, lift: 0, jumpAt: -1e9, carry: null,
      };
      this.npcs.set(v.id, npc);
    } else if (npc.spot.tile.x !== spot.tile.x || npc.spot.tile.y !== spot.tile.y) {
      // Walk from where the bot stands now: out of its house, across the street or plaza, into the next one.
      this.cancelCarry(npc);
      npc.stand = null;
      npc.route = findPath(this.tileOf(npc), spot.tile);
      npc.nextWander = this.time.now + wanderDelay(v.id, npc.wanderN);
    } else if (npc.stand && (v.mode !== 'idle' || v.meeting)) {
      npc.stand = null;
      npc.route = findPath(this.tileOf(npc), spot.tile);
    }
    const changed = npc.mode !== v.mode || npc.view.meeting !== v.meeting;
    npc.view = v;
    npc.spot = spot;
    npc.index = index;
    if (npc.route.length === 0 && !npc.walking) { const t = this.feet(this.target(npc)); npc.sprite.setPosition(t.x, t.y); }
    npc.sprite.setDepth(100 + npc.sprite.y);
    this.repaintNpcPill(npc);
    if (changed) this.applyNpcMode(npc, v.mode);
  }

  private repaintNpcPill(n: Npc): void {
    const dot = this.time.now < n.busyUntil ? AMBER : modeColor(n.view.mode, n.view.meeting);
    this.drawPill(n.pill, n.view.name, dot, n.view.badge);
  }

  // Pills sit above the head; when two would touch, the later one is lifted (pill-layout).
  private layoutPills(): void {
    const boxes = [...this.npcs.values()].map((n) => ({
      id: n.view.id, x: n.sprite.x, y: n.sprite.y - 17 - (n.pill.h * this.labelScale) / 2,
      w: n.pill.w * this.labelScale, h: n.pill.h * this.labelScale,
    }));
    const lifts = nudgePills(boxes);
    for (const n of this.npcs.values()) n.pill.c.setPosition(Math.round(n.sprite.x), Math.round(n.sprite.y - 17 - n.lift - (n.carry?.phase === 'go' ? 9 : 0) - (lifts.get(n.view.id) ?? 0)));
  }

  private tileOf(n: Npc): Point {
    return { x: toTile(n.sprite.x), y: toTile(n.sprite.y - 1) };
  }

  private target(n: Npc): Point {
    return n.stand ?? n.spot.tile;
  }

  private canWander(n: Npc): boolean {
    return n.view.mode === 'idle' && !n.view.meeting && n.spot.station === 'plaza' && !n.carry && n.route.length === 0 && !n.walking;
  }

  private maybeWander(n: Npc, now: number): void {
    if (now < n.nextWander || !this.canWander(n)) return;
    const occupied = new Set<string>();
    for (const o of this.npcs.values()) { occupied.add(tileKey(o.spot.tile)); occupied.add(tileKey(this.target(o))); occupied.add(tileKey(this.tileOf(o))); }
    const to = pickWanderTile(n.view.id, n.wanderN, this.tileOf(n), this.wanderPool, occupied);
    n.wanderN++;
    const route = to ? findPath(this.tileOf(n), to) : [];
    const last = route[route.length - 1];
    if (!to || !last || last.x !== to.x || last.y !== to.y) { n.nextWander = now + wanderDelay(n.view.id, n.wanderN); return; }
    n.stand = to;
    n.route = route;
    n.nextWander = now + wanderDelay(n.view.id, n.wanderN) + (route.length * TILE * 1000) / WALK_SPEED;
  }

  private moveNpcs(dt: number): void {
    const now = this.time.now;
    for (const n of this.npcs.values()) {
      const sp = n.sprite;
      const next = n.route[0];
      let bob = { lift: 0, sx: 1, sy: 1 };
      if (next) {
        const tx = tileCenter(next.x);
        const ty = (next.y + 1) * TILE - 1;
        const dx = tx - sp.x;
        const dy = ty - sp.y;
        const dist = Math.hypot(dx, dy);
        const step = Math.min(dist, (WALK_SPEED * dt) / 1000);
        if (dist <= step) { sp.setPosition(tx, ty); n.route.shift(); } else { sp.x += (dx / dist) * step; sp.y += (dy / dist) * step; }
        n.face = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
        n.walking = true;
        n.phase += stepPhase(step);
        bob = walkBob(n.phase);
        n.dust += step;
        if (n.dust >= 7) { n.dust = 0; this.emit('dust', sp.x + (Math.random() - 0.5) * 4, sp.y - 1, (Math.random() - 0.5) * 8, -6, 420); }
        sp.setFrame(this.frameOf(n, 1 + (Math.floor(now / 140) % 2)));
        sp.setScale(bob.sx, bob.sy);
      } else if (n.walking) {
        n.walking = false;
        n.phase = 0;
        const f = this.feet(this.target(n));
        sp.setPosition(f.x, f.y);
        if (!n.stand) n.face = n.spot.face;
        sp.setScale(1, sp.scaleY);
        sp.setFrame(this.frameOf(n, 0));
      }
      this.stepCarry(n);
      this.maybeWander(n, now);
      const jk = (now - n.jumpAt) / JUMP_MS;
      n.lift = bob.lift + (jk >= 0 && jk < 1 ? jumpLift(jk) : 0);
      sp.setOrigin(0.5, 1 + n.lift / TILE);
      sp.setDepth(100 + sp.y);
      const seatedStill = n.spot.seated && !n.stand && !n.walking && !n.carry;
      n.shadow.setVisible(!seatedStill).setPosition(Math.round(sp.x), Math.round(sp.y) - 1).setDepth(sp.depth - 0.5).setScale(Math.max(0.5, 1 - n.lift * 0.06));
      if (n.carry?.phase === 'go') n.carry.box.setPosition(Math.round(sp.x), Math.round(sp.y - 15 - n.lift)).setDepth(sp.depth + 1);
    }
  }

  // ---- handover on foot ----

  // The sender walks to the receiver with a box over its head. false = fall back to the flying item.
  private startCarry(f: Flight): boolean {
    const from = f.from ? this.npcs.get(f.from) : undefined;
    const to = this.npcs.get(f.to);
    if (!from || !to || from === to) return false;
    if (from.carry || from.walking || from.route.length > 0 || to.walking || to.route.length > 0) return false;
    const taken = new Set<string>();
    for (const o of this.npcs.values()) if (o !== to) { taken.add(tileKey(this.target(o))); taken.add(tileKey(this.tileOf(o))); }
    const plan = planCarry(this.tileOf(from), this.tileOf(to), (p) => !isBlocked(p.x, p.y) && !taken.has(tileKey(p)), findPath);
    if (!plan) return false;
    const box = this.add.image(from.sprite.x, from.sprite.y - 15, 'box').setOrigin(0.5, 1).setDepth(9_000);
    from.carry = { phase: 'go', receiver: to.view.id, box, prevStand: from.stand };
    from.stand = plan.adjacent;
    from.route = plan.go;
    const ms = 1500 + plan.go.length * ((TILE * 1000) / WALK_SPEED);
    for (const n of [from, to]) { n.busyUntil = this.time.now + ms; this.repaintNpcPill(n); }
    this.time.delayedCall(ms + 100, () => { for (const n of [from, to]) if (this.npcs.has(n.view.id)) this.repaintNpcPill(n); });
    return true;
  }

  private stepCarry(n: Npc): void {
    const c = n.carry;
    if (!c || n.route.length > 0 || n.walking) return;
    if (c.phase === 'back') { n.carry = null; return; }
    const r = this.npcs.get(c.receiver);
    if (!r) { this.cancelCarry(n); return; }
    const dx = r.sprite.x - n.sprite.x;
    const dy = r.sprite.y - n.sprite.y;
    n.face = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    n.sprite.setFrame(this.frameOf(n, 0));
    const box = c.box;
    const a = { x: box.x, y: box.y };
    n.carry = { ...c, phase: 'back', box };
    this.tweens.addCounter({
      from: 0, to: 1, duration: 380, ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        box.setPosition(Math.round(a.x + (r.sprite.x - a.x) * k), Math.round(a.y + (r.sprite.y - 15 - r.lift - a.y) * k - Math.sin(k * Math.PI) * 10)).setDepth(9_000);
      },
      onComplete: () => {
        this.tweens.add({ targets: r.sprite, scaleX: 1.2, scaleY: 1.2, duration: 110, yoyo: true });
        box.setPosition(Math.round(r.sprite.x), Math.round(r.sprite.y - 15));
        this.tweens.add({ targets: box, alpha: 0, y: box.y - 6, delay: 500, duration: 400, onComplete: () => box.destroy() });
      },
    });
    n.stand = c.prevStand;
    n.route = findPath(this.tileOf(n), this.target(n));
    if (n.route.length === 0) n.carry = null;
  }

  private cancelCarry(n: Npc): void {
    if (!n.carry) return;
    if (n.carry.phase === 'go') n.carry.box.destroy();
    n.carry = null;
  }

  private applyNpcMode(n: Npc, mode: NpcView['mode']): void {
    for (const t of n.tweens) t.stop();
    for (const e of n.extras) e.destroy();
    n.tweens = [];
    n.extras = [];
    n.mode = mode;
    n.sprite.setAngle(0).setScale(1);
    const s = npcSprite(mode);
    const meeting = n.view.meeting;
    // Seated workers "type": a tiny stretch. Standing bots breathe. No tween moves the sprite, so walking stays exact.
    if (s.anim === 'work' || meeting) {
      n.tweens.push(this.tweens.add({ targets: n.sprite, scaleY: 1.04, duration: 320 + (n.view.id.length % 4) * 40, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    } else if (s.anim === 'idle') {
      n.tweens.push(this.tweens.add({ targets: n.sprite, scaleY: 1.05, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    } else {
      n.tweens.push(this.tweens.add({ targets: n.sprite, angle: 3, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    }
    if (s.bubble && !meeting) {
      // Beside the body, never on the name tag above the head.
      const b = this.add.text(0, 0, s.bubble, {
        fontFamily: `${FONT}, monospace`, fontSize: '16px', color: s.bubble === 'zz' ? '#bcd7ff' : '#ffd166', stroke: '#0a0908', strokeThickness: 3,
      }).setOrigin(0, 1).setScale(0.5).setDepth(10_000);
      b.setData('bubble', true);
      n.extras.push(b);
    }
  }

  // A violet ring under each bot picked for a meeting.
  private placeRings(): void {
    for (const [id, r] of this.rings) if (!this.selected.has(id) || !this.npcs.has(id)) { r.destroy(); this.rings.delete(id); }
    for (const id of this.selected) {
      const n = this.npcs.get(id);
      if (!n) continue;
      let r = this.rings.get(id);
      if (!r) { r = this.add.ellipse(0, 0, 14, 6, MEET, 0.35).setStrokeStyle(1, MEET); this.rings.set(id, r); }
      r.setPosition(Math.round(n.sprite.x), Math.round(n.sprite.y) - 1).setDepth(n.sprite.depth - 0.5);
    }
  }

  private placeBubbles(): void {
    const t = this.time.now / 900;
    for (const n of this.npcs.values()) {
      for (const e of n.extras) {
        const b = e as Phaser.GameObjects.Text;
        if (!b.getData('bubble')) continue;
        b.setPosition(Math.round(n.sprite.x + 7), Math.round(n.sprite.y - 8 - Math.sin(t) * 2)).setAlpha(0.7 + Math.sin(t) * 0.3);
      }
    }
  }

  private removeNpc(id: string, n: Npc): void {
    this.cancelCarry(n);
    n.shadow.destroy();
    for (const t of n.tweens) t.stop();
    for (const e of n.extras) e.destroy();
    this.pills = this.pills.filter((p) => p !== n.pill);
    n.pill.c.destroy();
    n.sprite.destroy();
    this.npcs.delete(id);
  }

  // A small item arcs from the sender (or the street, when nobody is named) to the receiver.
  private fly(f: Flight): void {
    const to = this.npcs.get(f.to);
    if (!to) return;
    const from = f.from ? this.npcs.get(f.from) : undefined;
    const a = from ? { x: from.sprite.x, y: from.sprite.y - 8 } : { x: tileCenter(PLAZA.x0 + 7), y: PLAZA.y0 * TILE };
    const b = { x: to.sprite.x, y: to.sprite.y - 10 };
    const item = this.add.sprite(a.x, a.y, 'dungeon', F.potion).setDepth(9_000).setScale(0.75);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const duration = 700 + dist * 7;
    for (const n of [from, to]) if (n) { n.busyUntil = this.time.now + duration + 600; this.repaintNpcPill(n); }
    this.time.delayedCall(duration + 650, () => { for (const n of [from, to]) if (n && this.npcs.has(n.view.id)) this.repaintNpcPill(n); });
    this.tweens.addCounter({
      from: 0, to: 1, duration, ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        item.setPosition(Math.round(a.x + (b.x - a.x) * k), Math.round(a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * 22)).setAngle(k * 360);
      },
      onComplete: () => {
        item.destroy();
        this.tweens.add({ targets: to.sprite, scaleX: 1.25, scaleY: 1.25, duration: 120, yoyo: true });
      },
    });
  }

  // ---- avatar ----

  private buildAvatar(): void {
    const f = this.feet(AVATAR_SPAWN);
    this.avatar = this.add.sprite(f.x, f.y, 'urban', charFrame(AVATAR_CHAR, 0, 'down')).setOrigin(0.5, 1).setDepth(100 + f.y);
    this.avatarPill = this.makePill({ text: 'Deck', anchor: 'center', dot: GREEN, icon: null });
    this.marker = this.add.ellipse(0, 0, 10, 5, GREEN, 0.5).setStrokeStyle(1, GREEN).setDepth(3).setVisible(false);
  }

  private bindInput(): void {
    const kb = this.input.keyboard;
    if (kb) {
      const k = (c: string) => kb.addKey(c, false);
      this.keys = { W: k('W'), A: k('A'), S: k('S'), D: k('D'), UP: k('UP'), DOWN: k('DOWN'), LEFT: k('LEFT'), RIGHT: k('RIGHT') };
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
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
      this.userMoved = true;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const d = this.downAt.get(p.id);
      this.downAt.delete(p.id);
      if (!d || this.pinching || p.rightButtonReleased()) return;
      if (Math.hypot(p.x - d.x, p.y - d.y) > 8) return;
      p.updateWorldPoint(this.cameras.main);
      const hit = this.npcAt(p.worldX, p.worldY);
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
    this.userMoved = true;
    this.cameras.main.setZoom(stepZoom(this.cameras.main.zoom, dir));
  }

  private npcAt(wx: number, wy: number): string | null {
    let best: string | null = null;
    let bestD = Infinity;
    for (const [id, n] of this.npcs) {
      const f = { x: n.sprite.x, y: n.sprite.y };
      if (Math.abs(wx - f.x) <= 9 && wy >= f.y - 20 && wy <= f.y + 3) {
        const d = Math.hypot(wx - f.x, wy - (f.y - 8));
        if (d < bestD) { best = id; bestD = d; }
      }
    }
    return best;
  }

  private moveTo(wx: number, wy: number): void {
    const from = { x: toTile(this.avatar.x), y: toTile(this.avatar.y - 1) };
    const path = findPath(from, { x: toTile(wx), y: toTile(wy) });
    if (path.length === 0) return;
    this.route = path;
    const end = path[path.length - 1]!;
    if (!this.recording) this.marker.setPosition(tileCenter(end.x), (end.y + 1) * TILE - 2).setVisible(true);
  }

  private blockedAt(x: number, y: number): boolean {
    return [[-4, -1], [4, -1], [-4, -5], [4, -5]].some(([dx, dy]) => isBlocked(toTile(x + dx!), toTile(y + dy!)));
  }

  private stepAvatar(dt: number): void {
    const k = this.keys;
    let vx = 0;
    let vy = 0;
    if (k) {
      vx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      vy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    }
    const a = this.avatar;
    if (vx !== 0 || vy !== 0) {
      this.route = [];
      this.marker.setVisible(false);
    } else if (this.route.length > 0) {
      const next = this.route[0]!;
      const dx = tileCenter(next.x) - a.x;
      const dy = (next.y + 1) * TILE - 1 - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) { this.route.shift(); if (this.route.length === 0) this.marker.setVisible(false); } else { vx = dx / dist; vy = dy / dist; }
    }
    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      const step = (AVATAR_SPEED * dt) / 1000;
      const nx = a.x + (vx / len) * step;
      const ny = a.y + (vy / len) * step;
      if (!this.blockedAt(nx, a.y)) a.x = nx;
      if (!this.blockedAt(a.x, ny)) a.y = ny;
      this.avatarFace = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
      a.setFrame(charFrame(AVATAR_CHAR, 1 + (Math.floor(this.time.now / 130) % 2), this.avatarFace));
    } else {
      a.setFrame(charFrame(AVATAR_CHAR, 0, this.avatarFace));
    }
    a.setDepth(100 + a.y);
    this.avatarPill.c.setPosition(Math.round(a.x), Math.round(a.y) - 17);
  }

  // ---- camera ----

  private applyMode(animate: boolean): void {
    const cam = this.cameras.main;
    if (this.mode === 'god') {
      cam.stopFollow();
      cam.removeBounds();
      // The border row/column may be cropped; the plaza, street and houses are what must fit.
      cam.setZoom(initialZoom(cam.width, cam.height, (MAP_W - 2) * TILE, (MAP_H - 2) * TILE, FOCUS_W, (MAP_H - 2) * TILE));
      cam.centerOn((MAP_W * TILE) / 2, (MAP_H * TILE) / 2);
      const focus = parseFocus(location.search);
      const house = focus ? HOUSES.find((h) => h.id === focus.house) : undefined;
      if (focus && house) { cam.setZoom(focus.zoom); cam.centerOn((house.x + house.w / 2) * TILE, (house.y + house.h / 2) * TILE); this.userMoved = true; }
      this.applyLabelScale();
      return;
    }
    const z = clampZoom(this.opts.coarse ? 2 : 3);
    void animate;
    cam.setZoom(z);
    cam.startFollow(this.avatar, true, 0.12, 0.12);
    this.applyLabelScale();
  }

  update(_t: number, dt: number): void {
    this.stepAvatar(dt);
    this.moveNpcs(dt);
    this.renderParticles(dt);
    this.applyLabelScale();
    this.layoutPills();
    this.placeBubbles();
    this.placeRings();
    this.pinch();
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

export function createWorld(opts: WorldOptions): WorldHandle {
  const scene = new WorldScene(opts);
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
    refresh: () => game.scale.refresh(),
    destroy: () => game.destroy(true),
  };
}
