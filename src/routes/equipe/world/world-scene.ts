import Phaser from 'phaser';
import {
  AVATAR_SPAWN, FLOWER_BEDS, HOUSES, MAP_H, MAP_W, PLAZA, PLAZA_ITEMS, ROAD, STREET, STREET_SIGN, TILE, TREES,
  doorTiles, findPath, isBlocked, plazaSlots, tf, tileCenter, toTile, type HouseDef, type Item, type Point, type Sheet,
} from './world-map';
import { clampZoom, initialZoom, parseFocus, stepZoom, wheelStep, type CameraMode } from './camera-mode';
import { npcSprite, type Flight, type NpcView, type WorldView } from './world-state';

// Phaser lives only in this module, loaded with a dynamic import from TeamWorld.tsx.
// Art: Kenney CC0 sheets and font in /world (see LICENSES.md). 16px tiles, whole zoom only.

const BASE = import.meta.env.BASE_URL;
const FONT = 'KenneyMini';

const F = {
  grass: 0, flowerA: 1, flowerB: 2, dirt: tf(1, 2), stone: tf(7, 3), floor: tf(1, 9),
  wallTL: tf(0, 8), wallT: tf(1, 8), wallTR: tf(2, 8), wallL: tf(0, 9), wallR: tf(2, 9), wallBL: tf(0, 10), wallB: tf(1, 10), wallBR: tf(2, 10),
  treeTop: tf(4, 0), treeBase: tf(4, 1), autumnTop: tf(3, 0), autumnBase: tf(3, 1), bush: tf(5, 0),
  hammer: tf(9, 9), potion: tf(8, 9),
};

// Distinct Tiny Dungeon characters for the bots; the avatar has its own.
const NPC_FRAMES = [tf(0, 7), tf(1, 7), tf(2, 7), tf(3, 7), tf(4, 7), tf(0, 8), tf(1, 8), tf(2, 8), tf(4, 8), tf(4, 9), tf(1, 9)];
const AVATAR_FRAME = tf(3, 8);

const GREEN = 0x3fd17f;
const GREY = 0x8d8a85;
const AMBER = 0xf5a524;
const INK = 0x0a0908;
const PILL = 0x14110f;
const PILL_LINE = 0x39342e;
const AVATAR_SPEED = 72;
const FOCUS_W = (PLAZA.x1 - PLAZA.x0 + 3) * TILE;

const modeColor = (m: NpcView['mode']): number => (m === 'working' ? GREEN : m === 'waiting' ? AMBER : GREY);

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
  onReady?: () => void;
}

export interface WorldHandle {
  update: (view: WorldView) => void;
  setMode: (mode: CameraMode) => void;
  setRecording: (recording: boolean) => void;
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
}

interface Npc {
  view: NpcView;
  sprite: Phaser.GameObjects.Sprite;
  pill: Pill;
  extras: Phaser.GameObjects.GameObject[];
  tweens: Phaser.Tweens.Tween[];
  mode: NpcView['mode'] | null;
  slot: Point;
  index: number;
  busyUntil: number;
}

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
  private marker!: Phaser.GameObjects.Ellipse;
  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', Phaser.Input.Keyboard.Key>;
  private downAt = new Map<number, Point>();
  private pinchDist = 0;
  private pinchRatio = 1;
  private wheelAcc = 0;
  private pinching = false;
  private userMoved = false;

  constructor(opts: WorldOptions) {
    super('world');
    this.opts = opts;
    this.mode = opts.mode;
  }

  preload(): void {
    const sheet = { frameWidth: TILE, frameHeight: TILE };
    this.load.spritesheet('town', `${BASE}world/town.png`, sheet);
    this.load.spritesheet('dungeon', `${BASE}world/dungeon.png`, sheet);
    this.load.spritesheet('indoor', `${BASE}world/indoor.png`, { ...sheet, spacing: 1 });
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor(INK);
    cam.roundPixels = true;
    this.buildGround();
    this.buildStreet();
    this.buildPlaza();
    for (const h of HOUSES) this.buildHouse(h);
    this.buildTrees();
    this.buildAvatar();
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
    for (const h of HOUSES) this.setPillBadge(this.housePills.get(h.id)!, view.projects[h.id] ?? null);
    const slots = plazaSlots(view.npcs.length);
    const live = new Set(view.npcs.map((n) => n.id));
    for (const [id, npc] of this.npcs) if (!live.has(id)) this.removeNpc(id, npc);
    view.npcs.forEach((v, i) => this.upsertNpc(v, slots[i]!, i));
    for (const f of view.flights) {
      if (this.seenFlights.has(f.key)) continue;
      this.seenFlights.add(f.key);
      this.fly(f);
    }
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

  // ---- map ----

  private img(sheet: Sheet, frame: number, tx: number, ty: number, depth: number, tint?: number): Phaser.GameObjects.Image {
    const i = this.add.image(tx * TILE, ty * TILE, sheet, frame).setOrigin(0, 0).setDepth(depth);
    if (tint !== undefined) i.setTint(tint);
    return i;
  }

  private rect(x: number, y: number, w: number, h: number, color: number, alpha: number, depth: number): Phaser.GameObjects.Rectangle {
    return this.add.rectangle(x, y, w, h, color, alpha).setOrigin(0, 0).setDepth(depth);
  }

  private buildGround(): void {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const h = hash(x, y);
        this.img('town', h < 5 ? F.flowerA : h < 8 ? F.flowerB : F.grass, x, y, 0);
      }
    }
  }

  private buildStreet(): void {
    for (let x = STREET.x0; x <= STREET.x1; x++) {
      this.img('town', F.floor, x, STREET.y0, 1, 0xd9d3c6);
      this.img('town', F.floor, x, STREET.y1, 1, 0xd9d3c6);
      for (let y = ROAD.y0; y <= ROAD.y1; y++) this.img('town', F.dirt, x, y, 1, 0x9b8e84);
      if (x % 2 === 0) this.rect(x * TILE + 3, (ROAD.y0 + 1) * TILE - 1, 10, 2, 0xf2ead8, 0.65, 2);
    }
    // Curbs and sidewalk edges.
    this.rect(STREET.x0 * TILE, ROAD.y0 * TILE - 1, (STREET.x1 - STREET.x0 + 1) * TILE, 2, 0x2f2a25, 0.9, 2);
    this.rect(STREET.x0 * TILE, (ROAD.y1 + 1) * TILE - 1, (STREET.x1 - STREET.x0 + 1) * TILE, 2, 0x2f2a25, 0.9, 2);
    for (const h of HOUSES) for (const d of doorTiles(h)) this.img('town', F.floor, d.x, d.y + 1, 1, 0xd9d3c6);
    this.label(STREET_SIGN);
  }

  private label(p: Point): void {
    const pill = this.makePill({ text: 'Rua dos Projetos', anchor: 'left', dot: null, icon: null });
    pill.c.setPosition(p.x * TILE, p.y * TILE - 2);
  }

  private buildPlaza(): void {
    for (let y = PLAZA.y0; y <= PLAZA.y1; y++) {
      for (let x = PLAZA.x0; x <= PLAZA.x1; x++) this.img('town', F.floor, x, y, 1, (x + y) % 2 === 0 ? 0xe6d9bb : 0xdacdae);
    }
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
    this.drawItems(PLAZA_ITEMS, 0, 0);
  }

  private drawItems(items: Item[], ox: number, oy: number): void {
    for (const i of items) {
      const x = ox + i.x;
      const y = oy + i.y;
      const layer = i.layer;
      const depth = layer === 'floor' ? 3 : layer === 'wall' ? 4 : layer === 'top' ? 7 : 6;
      const img = this.img(i.s, i.f, x, y, depth);
      if (layer === 'top') img.y -= 4;
      if (i.block && layer !== 'top') this.rect(x * TILE + 1, (y + 1) * TILE, 14, 3, INK, 0.3, 5);
    }
  }

  private buildHouse(h: HouseDef): void {
    const doors = new Set(doorTiles(h).map((d) => `${d.x},${d.y}`));
    for (let dx = 0; dx < h.w; dx++) {
      for (let dy = 0; dy < h.h; dy++) {
        const x = h.x + dx;
        const y = h.y + dy;
        const top = dy === 0;
        const bottom = dy === h.h - 1;
        const left = dx === 0;
        const right = dx === h.w - 1;
        if (doors.has(`${x},${y}`)) { this.img('town', F.floor, x, y, 2, 0xb59a74); continue; }
        if (!top && !bottom && !left && !right) { this.img('town', F.floor, x, y, 2, (x + y) % 2 === 0 ? h.tint : shade(h.tint, 0.93)); continue; }
        const frame = top ? (left ? F.wallTL : right ? F.wallTR : F.wallT)
          : bottom ? (left ? F.wallBL : right ? F.wallBR : F.wallB)
            : left ? F.wallL : F.wallR;
        this.img('town', frame, x, y, 5);
      }
    }
    // Depth: shade under the back wall, along the side walls and below the house.
    this.rect((h.x + 1) * TILE, (h.y + 1) * TILE, (h.w - 2) * TILE, 6, INK, 0.2, 3);
    this.rect((h.x + 1) * TILE, (h.y + 1) * TILE, 3, (h.h - 2) * TILE, INK, 0.12, 3);
    this.rect((h.x + h.w - 1) * TILE - 3, (h.y + 1) * TILE, 3, (h.h - 2) * TILE, INK, 0.12, 3);
    this.rect(h.x * TILE, (h.y + h.h) * TILE, h.w * TILE, 4, INK, 0.25, 1);
    this.drawItems(h.items, h.x, h.y);
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
    const pill: Pill = { c, text, g, icon, badge: null, anchor: o.anchor, h: 22 };
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
    for (const n of this.npcs.values()) this.placeNpcLabels(n);
  }

  // ---- NPCs ----

  private feet(p: Point): { x: number; y: number } {
    return { x: tileCenter(p.x), y: (p.y + 1) * TILE - 1 };
  }

  private upsertNpc(v: NpcView, slot: Point, index: number): void {
    let npc = this.npcs.get(v.id);
    const f = this.feet(slot);
    if (!npc) {
      const sprite = this.add.sprite(f.x, f.y, 'dungeon', NPC_FRAMES[index % NPC_FRAMES.length]).setOrigin(0.5, 1);
      const pill = this.makePill({ text: v.name, anchor: 'center', dot: modeColor(v.mode), icon: null, badge: v.badge });
      npc = { view: v, sprite, pill, extras: [], tweens: [], mode: null, slot, index, busyUntil: 0 };
      this.npcs.set(v.id, npc);
    }
    npc.view = v;
    npc.slot = slot;
    npc.index = index;
    npc.sprite.setPosition(f.x, f.y).setDepth(100 + f.y);
    this.repaintNpcPill(npc);
    if (npc.mode !== v.mode) this.applyNpcMode(npc, v.mode);
    this.placeNpcLabels(npc);
  }

  private repaintNpcPill(n: Npc): void {
    const dot = this.time.now < n.busyUntil ? AMBER : modeColor(n.view.mode);
    this.drawPill(n.pill, n.view.name, dot, n.view.badge);
  }

  private placeNpcLabels(n: Npc): void {
    const { x, y } = n.sprite;
    // Neighbours are closer than a pill is wide: odd slots sit one pill higher.
    const lift = n.index % 2 === 1 ? (n.pill.h + 1) * this.labelScale : 0;
    n.pill.c.setPosition(x, y - 17 - lift);
  }

  private applyNpcMode(n: Npc, mode: NpcView['mode']): void {
    for (const t of n.tweens) t.stop();
    for (const e of n.extras) e.destroy();
    n.tweens = [];
    n.extras = [];
    n.mode = mode;
    const baseY = n.sprite.y;
    n.sprite.setAngle(0).setScale(1);
    n.sprite.y = baseY;
    const s = npcSprite(mode);
    const { x } = n.sprite;
    if (s.anim === 'work') {
      n.tweens.push(this.tweens.add({ targets: n.sprite, y: baseY - 2, duration: 240 + (n.view.id.length % 4) * 30, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    } else if (s.anim === 'idle') {
      n.tweens.push(this.tweens.add({ targets: n.sprite, scaleY: 1.05, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    } else {
      n.tweens.push(this.tweens.add({ targets: n.sprite, angle: 4, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    }
    if (s.tool) {
      const tool = this.add.sprite(x + 8, baseY - 7, 'dungeon', F.hammer).setScale(0.7).setDepth(100 + baseY + 1);
      n.extras.push(tool);
      n.tweens.push(this.tweens.add({ targets: tool, angle: { from: -40, to: 25 }, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    }
    if (s.bubble) {
      const b = this.add.text(x + 11, baseY - 3, s.bubble, {
        fontFamily: `${FONT}, monospace`, fontSize: '16px', color: s.bubble === 'zz' ? '#bcd7ff' : '#ffd166', stroke: '#0a0908', strokeThickness: 3,
      }).setOrigin(0.5, 1).setScale(0.5).setDepth(10_000);
      n.extras.push(b);
      n.tweens.push(this.tweens.add({ targets: b, y: b.y - 4, alpha: { from: 1, to: s.bubble === 'zz' ? 0.35 : 1 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    }
  }

  private removeNpc(id: string, n: Npc): void {
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
    const a = from ? { x: from.sprite.x, y: this.feet(from.slot).y - 8 } : { x: tileCenter(PLAZA.x0 + 7), y: PLAZA.y0 * TILE };
    const b = { x: to.sprite.x, y: this.feet(to.slot).y - 10 };
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
    this.avatar = this.add.sprite(f.x, f.y, 'dungeon', AVATAR_FRAME).setOrigin(0.5, 1).setDepth(100 + f.y);
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
      if (hit) { this.opts.onOpenBot(hit); return; }
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
      const f = this.feet(n.slot);
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
      if (vx !== 0) a.setFlipX(vx < 0);
      a.setAngle(Math.sin(this.time.now / 70) * 6);
    } else {
      a.setAngle(0);
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
    this.applyLabelScale();
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
    refresh: () => game.scale.refresh(),
    destroy: () => game.destroy(true),
  };
}
