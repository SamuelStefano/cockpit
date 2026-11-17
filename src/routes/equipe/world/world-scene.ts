import Phaser from 'phaser';
import {
  AVATAR_SPAWN, CONNECTOR, HOUSES, MAP_H, MAP_W, PLAZA, PLAZA_CENTER, STREET, STREET_SIGN, TILE, TREES,
  doorTiles, findPath, isBlocked, plazaSlots, tileCenter, toTile, type HouseDef, type Point,
} from './world-map';
import { fitZoom, wheelZoom, clampZoom, type CameraMode } from './camera-mode';
import { npcSprite, type Flight, type NpcView, type WorldView } from './world-state';

// Phaser lives only in this module, loaded with a dynamic import from TeamWorld.tsx.
// Art: Kenney CC0 sheets in /world (see LICENSES.md). Frame = row * columns + column.

const BASE = import.meta.env.BASE_URL;
const TOWN = 'town';
const DUNGEON = 'dungeon';
const INDOOR = 'indoor';
const COLS = 12;
const ICOLS = 27;
const tf = (c: number, r: number): number => r * COLS + c;
const inf = (c: number, r: number): number => r * ICOLS + c;

const F = {
  grass: 0, flowerA: 1, flowerB: 2, dirtA: tf(4, 3), dirtB: tf(5, 3), stone: tf(7, 3), floor: tf(1, 9),
  wallTL: tf(0, 8), wallT: tf(1, 8), wallTR: tf(2, 8), wallL: tf(0, 9), wallR: tf(2, 9), wallBL: tf(0, 10), wallB: tf(1, 10), wallBR: tf(2, 10),
  treeTop: tf(4, 0), treeBase: tf(4, 1), autumnTop: tf(3, 0), autumnBase: tf(3, 1), bush: tf(5, 0), sign: tf(11, 6),
  shelfA: tf(3, 5), shelfB: tf(3, 6), hammer: tf(9, 9), potion: tf(8, 9),
  counterA: inf(0, 12), counterB: inf(4, 12), stoveTL: inf(14, 14), stoveTR: inf(15, 14), stoveBL: inf(14, 15), stoveBR: inf(15, 15),
  deskTL: inf(4, 2), deskTR: inf(5, 2), deskBL: inf(4, 3), deskBR: inf(5, 3), chair: inf(0, 2), plant: inf(16, 0),
};

// Distinct Tiny Dungeon characters for the bots; the avatar has its own.
const NPC_FRAMES = [tf(0, 7), tf(1, 7), tf(2, 7), tf(3, 7), tf(4, 7), tf(0, 8), tf(1, 8), tf(2, 8), tf(4, 8), tf(4, 9), tf(1, 9)];
const AVATAR_FRAME = tf(3, 8);

const GREEN = '#3fd17f';
const INK = '#0a0908';
const AVATAR_SPEED = 72;
const LABEL_FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';

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

interface Npc {
  view: NpcView;
  sprite: Phaser.GameObjects.Sprite;
  name: Phaser.GameObjects.Text;
  badge: Phaser.GameObjects.Text | null;
  extras: Phaser.GameObjects.GameObject[];
  tweens: Phaser.Tweens.Tween[];
  mode: NpcView['mode'] | null;
  slot: Point;
}

const hash = (x: number, y: number): number => Math.abs((x * 73856093) ^ (y * 19349663)) % 100;

class WorldScene extends Phaser.Scene {
  private readonly opts: WorldOptions;
  private mode: CameraMode;
  private recording = false;
  private ready = false;
  private pendingView: WorldView | null = null;
  private npcs = new Map<string, Npc>();
  private seenFlights = new Set<string>();
  private labels: Phaser.GameObjects.Text[] = [];
  private labelScale = 1;
  private avatar!: Phaser.GameObjects.Sprite;
  private route: Point[] = [];
  private marker!: Phaser.GameObjects.Ellipse;
  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', Phaser.Input.Keyboard.Key>;
  private downAt = new Map<number, Point>();
  private pinchDist = 0;
  private pinching = false;
  private userMoved = false;

  constructor(opts: WorldOptions) {
    super('world');
    this.opts = opts;
    this.mode = opts.mode;
  }

  preload(): void {
    const sheet = { frameWidth: TILE, frameHeight: TILE };
    this.load.spritesheet(TOWN, `${BASE}world/town.png`, sheet);
    this.load.spritesheet(DUNGEON, `${BASE}world/dungeon.png`, sheet);
    this.load.spritesheet(INDOOR, `${BASE}world/indoor.png`, { ...sheet, spacing: 1 });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(INK);
    this.buildGround();
    this.buildStreet();
    for (const h of HOUSES) this.buildHouse(h);
    this.buildTrees();
    this.buildAvatar();
    this.bindInput();
    this.scale.on('resize', () => { if (this.mode === 'god' && !this.userMoved) this.applyMode(false); });
    this.ready = true;
    this.applyMode(false);
    if (this.pendingView) this.sync(this.pendingView);
    this.opts.onReady?.();
  }

  // ---- public ----

  sync(view: WorldView): void {
    if (!this.ready) { this.pendingView = view; return; }
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

  private img(sheet: string, frame: number, tx: number, ty: number, depth: number, tint?: number): Phaser.GameObjects.Image {
    const i = this.add.image(tx * TILE, ty * TILE, sheet, frame).setOrigin(0, 0).setDepth(depth);
    if (tint !== undefined) i.setTint(tint);
    return i;
  }

  private buildGround(): void {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const h = hash(x, y);
        this.img(TOWN, h < 6 ? F.flowerA : h < 10 ? F.flowerB : F.grass, x, y, 0);
      }
    }
  }

  private buildStreet(): void {
    const dirt = (x: number, y: number) => this.img(TOWN, hash(x, y) < 12 ? F.dirtB : F.dirtA, x, y, 1);
    for (let y = STREET.y0; y <= STREET.y1; y++) for (let x = STREET.x0; x <= STREET.x1; x++) dirt(x, y);
    for (let y = CONNECTOR.y0; y <= CONNECTOR.y1; y++) for (let x = CONNECTOR.x0; x <= CONNECTOR.x1; x++) dirt(x, y);
    for (const h of HOUSES) for (const d of doorTiles(h)) { dirt(d.x, d.y + 1); dirt(d.x, d.y + 2); }
    for (let y = PLAZA.y0; y <= PLAZA.y1; y++) for (let x = PLAZA.x0; x <= PLAZA.x1; x++) this.img(TOWN, F.floor, x, y, 1, 0xe9dcc0);
    for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) this.img(TOWN, F.stone, PLAZA_CENTER.x + dx, PLAZA_CENTER.y + dy, 2);
    this.img(TOWN, F.sign, STREET_SIGN.x, STREET_SIGN.y, 20);
    this.label('Rua dos Projetos', (STREET_SIGN.x + 1) * TILE + 2, tileCenter(STREET.y0 + 1), { color: '#ffffff', anchorX: 0, anchorY: 0.5, size: 10 });
    this.label('Praça', PLAZA_CENTER.x * TILE, PLAZA.y0 * TILE + 3, { color: '#ffffff', anchorX: 0.5, anchorY: 0, size: 9 });
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
        if (doors.has(`${x},${y}`)) { this.img(TOWN, F.dirtA, x, y, 2); continue; }
        if (!top && !bottom && !left && !right) { this.img(TOWN, F.floor, x, y, 2, h.tint); continue; }
        const frame = top ? (left ? F.wallTL : right ? F.wallTR : F.wallT)
          : bottom ? (left ? F.wallBL : right ? F.wallBR : F.wallB)
            : left ? F.wallL : F.wallR;
        this.img(TOWN, frame, x, y, 5);
      }
    }
    const at = (dx: number, dy: number) => ({ x: h.x + dx, y: h.y + dy });
    for (const dx of [1, 2, 3]) {
      this.img(DUNGEON, F.shelfA, at(dx, 1).x, at(dx, 1).y, 6);
      this.img(DUNGEON, F.shelfB, at(dx, 2).x, at(dx, 2).y, 6);
    }
    this.img(INDOOR, F.counterA, at(5, 1).x, at(5, 1).y, 6);
    this.img(INDOOR, F.counterB, at(6, 1).x, at(6, 1).y, 6);
    this.img(INDOOR, F.stoveTL, at(7, 1).x, at(7, 1).y, 6);
    this.img(INDOOR, F.stoveTR, at(8, 1).x, at(8, 1).y, 6);
    this.img(INDOOR, F.stoveBL, at(7, 2).x, at(7, 2).y, 6);
    this.img(INDOOR, F.stoveBR, at(8, 2).x, at(8, 2).y, 6);
    this.img(INDOOR, F.deskTL, at(3, 4).x, at(3, 4).y, 6);
    this.img(INDOOR, F.deskTR, at(4, 4).x, at(4, 4).y, 6);
    this.img(INDOOR, F.deskBL, at(3, 5).x, at(3, 5).y, 6);
    this.img(INDOOR, F.deskBR, at(4, 5).x, at(4, 5).y, 6);
    this.img(INDOOR, F.chair, at(3, 6).x, at(3, 6).y, 6);
    this.img(INDOOR, F.plant, at(8, 7).x, at(8, 7).y, 6);
    // Sign above the door side: project name and a small pixel icon.
    this.img(TOWN, F.sign, h.x + 4, h.y - 1, 20);
    this.img(TOWN, h.icon, h.x + 5, h.y - 1, 20);
    this.label(h.label, (h.x + h.w / 2) * TILE, (h.y - 1) * TILE, { color: '#ffffff', anchorX: 0.5, anchorY: 1, size: 11, bold: true });
  }

  private buildTrees(): void {
    for (const t of TREES) {
      const y = tileCenter(t.y) + TILE / 2;
      const autumn = hash(t.x, t.y) < 30;
      if (t.y === 6) { this.add.image(t.x * TILE, t.y * TILE, TOWN, F.bush).setOrigin(0, 0).setDepth(100 + y); continue; }
      this.add.image(t.x * TILE, (t.y - 1) * TILE, TOWN, autumn ? F.autumnTop : F.treeTop).setOrigin(0, 0).setDepth(100 + y);
      this.add.image(t.x * TILE, t.y * TILE, TOWN, autumn ? F.autumnBase : F.treeBase).setOrigin(0, 0).setDepth(100 + y);
    }
  }

  // ---- labels ----

  private label(text: string, x: number, y: number, o: { color: string; anchorX: number; anchorY: number; size: number; bold?: boolean; bg?: string; fg?: string }): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, text, {
      fontFamily: LABEL_FONT, fontSize: `${o.size}px`, fontStyle: o.bold ? 'bold' : 'normal', color: o.fg ?? o.color,
      stroke: INK, strokeThickness: o.bg ? 0 : 3, backgroundColor: o.bg, padding: o.bg ? { x: 2, y: 1 } : undefined,
    }).setOrigin(o.anchorX, o.anchorY).setDepth(10_000).setResolution(3);
    t.setScale(this.labelScale);
    this.labels.push(t);
    return t;
  }

  private rescaleLabels(): void {
    const z = this.cameras.main.zoom;
    const s = Math.min(2.4, Math.max(0.5, 1.05 / z));
    if (Math.abs(s - this.labelScale) < 0.01) return;
    this.labelScale = s;
    for (const t of this.labels) t.setScale(s);
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
      const sprite = this.add.sprite(f.x, f.y, DUNGEON, NPC_FRAMES[index % NPC_FRAMES.length]).setOrigin(0.5, 1);
      const name = this.label(v.name, f.x, f.y - 17, { color: '#ffffff', anchorX: 0.5, anchorY: 1, size: 9, bold: true });
      npc = { view: v, sprite, name, badge: null, extras: [], tweens: [], mode: null, slot };
      this.npcs.set(v.id, npc);
    }
    npc.view = v;
    npc.slot = slot;
    npc.name.setText(v.name);
    npc.sprite.setPosition(f.x, f.y).setDepth(100 + f.y);
    this.setBadge(npc, v.badge);
    if (npc.mode !== v.mode) this.applyNpcMode(npc, v.mode);
    this.placeNpcLabels(npc);
  }

  private placeNpcLabels(n: Npc): void {
    const { x, y } = n.sprite;
    n.name.setPosition(x, y - 17);
    n.badge?.setPosition(x - 6, y - 8);
  }

  private setBadge(n: Npc, text: string | null): void {
    if (!text) { n.badge?.destroy(); this.labels = this.labels.filter((l) => l !== n.badge); n.badge = null; return; }
    if (!n.badge) {
      n.badge = this.label(text, n.sprite.x - 6, n.sprite.y - 8, { color: INK, fg: INK, bg: GREEN, anchorX: 1, anchorY: 1, size: 8, bold: true });
    } else {
      n.badge.setText(text);
    }
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
      const tool = this.add.sprite(x + 8, baseY - 7, DUNGEON, F.hammer).setScale(0.7).setDepth(100 + baseY + 1);
      n.extras.push(tool);
      n.tweens.push(this.tweens.add({ targets: tool, angle: { from: -40, to: 25 }, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    }
    if (s.bubble) {
      const b = this.add.text(x + 10, baseY - 12, s.bubble, {
        fontFamily: LABEL_FONT, fontSize: s.bubble === 'zz' ? '8px' : '11px', fontStyle: 'bold', color: s.bubble === 'zz' ? '#bcd7ff' : '#ffd166', stroke: INK, strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(10_000).setResolution(3);
      n.extras.push(b);
      n.tweens.push(this.tweens.add({ targets: b, y: b.y - 4, alpha: { from: 1, to: s.bubble === 'zz' ? 0.35 : 1 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    }
  }

  private removeNpc(id: string, n: Npc): void {
    for (const t of n.tweens) t.stop();
    for (const e of n.extras) e.destroy();
    this.labels = this.labels.filter((l) => l !== n.name && l !== n.badge);
    n.name.destroy();
    n.badge?.destroy();
    n.sprite.destroy();
    this.npcs.delete(id);
  }

  // A small item arcs from the sender (or the street, when nobody is named) to the receiver.
  private fly(f: Flight): void {
    const to = this.npcs.get(f.to);
    if (!to) return;
    const from = f.from ? this.npcs.get(f.from) : undefined;
    const a = from ? { x: from.sprite.x, y: from.slot ? this.feet(from.slot).y - 8 : 0 } : { x: tileCenter(CONNECTOR.x0), y: CONNECTOR.y1 * TILE };
    const b = { x: to.sprite.x, y: this.feet(to.slot).y - 10 };
    const item = this.add.sprite(a.x, a.y, DUNGEON, F.potion).setDepth(9_000).setScale(0.75);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    this.tweens.addCounter({
      from: 0, to: 1, duration: 700 + dist * 7, ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        item.setPosition(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * 22).setAngle(k * 360);
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
    this.avatar = this.add.sprite(f.x, f.y, DUNGEON, AVATAR_FRAME).setOrigin(0.5, 1).setDepth(100 + f.y);
    const tag = this.label('Deck', f.x, f.y - 17, { color: INK, fg: INK, bg: GREEN, anchorX: 0.5, anchorY: 1, size: 9, bold: true });
    this.avatar.setData('tag', tag);
    this.marker = this.add.ellipse(0, 0, 10, 5, 0x3fd17f, 0.5).setStrokeStyle(1, 0x3fd17f).setDepth(3).setVisible(false);
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
      this.userMoved = true;
      this.cameras.main.setZoom(wheelZoom(this.cameras.main.zoom, dy));
    });
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
      const tx = tileCenter(next.x);
      const ty = (next.y + 1) * TILE - 1;
      const dx = tx - a.x;
      const dy = ty - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) { this.route.shift(); if (this.route.length === 0) this.marker.setVisible(false); } else { vx = dx / dist; vy = dy / dist; }
    }
    const moving = vx !== 0 || vy !== 0;
    if (moving) {
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
    (a.getData('tag') as Phaser.GameObjects.Text).setPosition(a.x, a.y - 17);
  }

  // ---- camera ----

  private applyMode(animate: boolean): void {
    const cam = this.cameras.main;
    if (this.mode === 'god') {
      cam.stopFollow();
      cam.removeBounds();
      const z = fitZoom(cam.width, cam.height, MAP_W * TILE, MAP_H * TILE);
      cam.setZoom(z);
      cam.centerOn((MAP_W * TILE) / 2, (MAP_H * TILE) / 2);
      return;
    }
    const z = clampZoom(this.opts.coarse ? 2.4 : 3);
    if (animate) cam.zoomTo(z, 350); else cam.setZoom(z);
    cam.startFollow(this.avatar, true, 0.12, 0.12);
  }

  update(_t: number, dt: number): void {
    this.stepAvatar(dt);
    this.rescaleLabels();
    this.pinch();
  }

  private pinch(): void {
    const { pointer1: p1, pointer2: p2 } = this.input;
    if (p1.isDown && p2.isDown) {
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      this.pinching = true;
      if (this.pinchDist > 0) {
        this.userMoved = true;
        this.cameras.main.setZoom(clampZoom(this.cameras.main.zoom * (d / this.pinchDist)));
      }
      this.pinchDist = d;
    } else {
      this.pinchDist = 0;
      if (!p1.isDown && !p2.isDown) this.pinching = false;
    }
  }
}

export function createWorld(opts: WorldOptions): WorldHandle {
  const scene = new WorldScene(opts);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: opts.parent,
    backgroundColor: INK,
    pixelArt: true,
    roundPixels: true,
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
