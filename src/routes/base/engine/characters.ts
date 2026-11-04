import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { FloorAgent, ModelFamily, Point } from '../types';
import { box, cyl, disposeTree, ink, inkMat, newMat, PAL } from './kit';
import { BIT_LIMB, buildBit, buildMascot, type BodyForm } from './bodyForm';
import { eyesFor, paintFace } from './face';
import { drawMonitor, H, STATE_LOOK, W } from './monitor';
import { Stroller, type StrollPose } from './stroll';

const FAMILY_COLOR: Record<ModelFamily, number> = { opus: PAL.terra, sonnet: PAL.blue, grok: PAL.char, haiku: 0x58a89a, codex: PAL.violet, unknown: 0x8d9299 };
const ROAMS: ReadonlySet<string> = new Set(['waiting', 'finished', 'working', 'reviewing']);
const angleTo = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

function limb(body: THREE.Object3D, x: number, y: number, z: number, l: number, m: THREE.Material): THREE.Group {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  body.add(p);
  const b = new THREE.Mesh(new RoundedBoxGeometry(0.3, l, 0.3, 2, 0.12), m);
  b.position.y = -l / 2;
  b.castShadow = true;
  p.add(b);
  return p;
}

function strollPose(p: StrollPose, T: number, ph: number) {
  const o = { by: 0.2, al: 0, ar: 0, ll: 0, lr: 0, rx: 0, hx: 0, hz: 0, ry: 0 };
  if (p === 'look') { o.ry = Math.sin(T * 0.8 + ph) * 1.1; o.hz = Math.sin(T * 1.3) * 0.12; }
  if (p === 'wave') { o.ar = -2.9 + Math.sin(T * 11) * 0.4; o.hz = 0.12; }
  if (p === 'stretch') { const k = (Math.sin(T * 1.6) + 1) / 2; o.al = o.ar = -3 * k; o.by = 0.2 + k * 0.18; o.rx = -0.12 * k; }
  if (p === 'dance') { o.by = 0.2 + Math.abs(Math.sin(T * 7)) * 0.42; o.ll = Math.sin(T * 7) * 0.5; o.lr = -o.ll; o.al = -2.7 + Math.sin(T * 7) * 0.5; o.ar = -2.7 - Math.sin(T * 7) * 0.5; o.ry = T * 2.4; }
  if (p === 'nap') { o.rx = -1.5; o.by = 0.75 + Math.sin(T * 1.5) * 0.04; o.ry = 0.5; }
  if (p === 'sip') { const k = Math.max(0, Math.sin(T * 1.2)); o.ar = -0.4 - k * 2; o.hx = -0.25 * k; }
  return o;
}

// A clay Bit, or a Grok mascot, at a desk: stubs and a repainted face. Cheap body, expensive acting.
export class AgentView {
  readonly g = new THREE.Group();
  readonly cv = document.createElement('canvas');
  readonly hit: THREE.Mesh;
  private tex: THREE.CanvasTexture;
  private mon = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private form = new THREE.Group();
  private formInfo: BodyForm | null = null;
  private torsoMesh: THREE.Mesh;
  private limbMat: THREE.MeshStandardMaterial;
  private faces: THREE.Mesh[] = [];
  private stroll = new Stroller();
  private blinkAt = 2 + Math.random() * 4;
  private armL: THREE.Group; private armR: THREE.Group; private legL: THREE.Group; private legR: THREE.Group;
  private torso: THREE.MeshStandardMaterial;
  private lamp: THREE.MeshStandardMaterial;
  private faceCv = document.createElement('canvas');
  private faceTex: THREE.CanvasTexture;
  private faceNow = '';
  private family: ModelFamily | '' = '';
  private home = new THREE.Vector3(0, 1.05, 1.75);
  private squash = 0; private squashV = 0;
  private walk: { to: THREE.Vector3; t: number } | null = null;
  private target = new THREE.Vector3();

  constructor(parent: THREE.Object3D, readonly id: string, a: FloorAgent) {
    const g = this.g;
    g.position.set(a.x, 0, a.z);
    this.target.set(a.x, 0, a.z);
    parent.add(g);
    box(g, 5.4, 0.25, 2.4, PAL.wood, 0, 1.5, 0);
    for (const [lx, lz] of [[-2.4, -1], [2.4, -1], [-2.4, 1], [2.4, 1]]) box(g, 0.22, 1.5, 0.22, PAL.woodDark, lx, 0.75, lz);
    cyl(g, 0.06, 0.1, 0.8, PAL.char, 2.1, 2, -0.4);
    this.lamp = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), this.lamp);
    lamp.position.set(2.1, 2.5, -0.4);
    g.add(lamp);
    cyl(g, 0.15, 0.13, 0.3, PAL.teal, -2, 1.77, 0.4);
    box(g, 0.8, 0.14, 1, 0xf4ead6, -1.9, 1.69, -0.45);
    this.cv.width = W; this.cv.height = H;
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mon.position.set(0, 2.6, -0.65);
    g.add(this.mon);
    box(this.mon, 2.9, 1.9, 0.14, PAL.char, 0, 0, -0.08);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.69), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    screen.position.z = 0.01;
    this.mon.add(screen);
    box(g, 0.25, 0.8, 0.2, PAL.char, 0, 1.95, -0.75);
    cyl(g, 0.65, 0.65, 0.18, 0x45444a, 0, 1, 1.75, 10);
    cyl(g, 0.1, 0.1, 1, PAL.char, 0, 0.5, 1.75);

    this.torso = newMat(FAMILY_COLOR[a.family]);
    this.limbMat = newMat(BIT_LIMB);
    const line = inkMat();
    const torso = new THREE.Mesh(new RoundedBoxGeometry(1.25, 1.3, 1.05, 3, 0.3), this.torso);
    torso.position.y = 0.72; torso.castShadow = true;
    ink(torso, line, 1.07);
    g.add(this.body);
    this.body.add(torso);
    this.torsoMesh = torso;
    this.head.position.y = 1.9;
    this.body.add(this.head);
    this.head.add(this.form);
    this.faceCv.width = this.faceCv.height = 128;
    this.faceTex = new THREE.CanvasTexture(this.faceCv);
    this.faceTex.colorSpace = THREE.SRGBColorSpace;
    const fm = new THREE.MeshBasicMaterial({ map: this.faceTex, transparent: true });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fm);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fm); back.rotation.y = Math.PI;
    this.faces = [front, back];
    this.head.add(front, back);
    this.armL = limb(this.body, -0.72, 1.15, 0, 0.8, this.limbMat); this.armR = limb(this.body, 0.72, 1.15, 0, 0.8, this.limbMat);
    this.legL = limb(this.body, -0.3, 0.2, 0, 0.45, this.limbMat); this.legR = limb(this.body, 0.3, 0.2, 0, 0.45, this.limbMat);
    this.body.position.copy(this.home);
    this.body.rotation.y = Math.PI;
    this.hit = box(g, 6, 4.6, 5, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), 0, 2.2, 0.6);
    this.hit.castShadow = false;
    this.hit.userData.agentId = id;
    // A roaming character stays clickable away from its desk.
    const bodyHit = box(this.body, 2, 3.4, 2, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), 0, 1.4, 0);
    bodyHit.castShadow = false;
    bodyHit.userData.agentId = id;
    this.setFamily(a.family);
  }

  private setFamily(f: ModelFamily) {
    if (f === this.family) return;
    this.family = f;
    this.torso.color.setHex(FAMILY_COLOR[f]);
    disposeTree(this.form);
    this.form.clear();
    const info = f === 'grok' ? buildMascot(this.form, this.id) : buildBit(this.form, FAMILY_COLOR[f]);
    this.formInfo = info;
    this.limbMat.color.setHex(info.limb);
    this.torsoMesh.visible = !info.hideTorso;
    const [front, back] = this.faces;
    for (const [m, z] of [[front, info.face.z], [back, -info.face.z]] as const) { m.position.set(info.face.x, info.face.y, z); m.scale.setScalar(info.face.size); }
    back.position.x = info.face.x;
    this.faceNow = '';
  }

  private drawFace(f: string, T: number, typing: boolean) {
    if (T > this.blinkAt + 0.13) this.blinkAt = T + 2 + Math.random() * 4;
    const blink = T > this.blinkAt && eyesFor(f) === 'open';
    const look = eyesFor(f) === 'open' ? Math.round(Math.sin(T * 0.7 + this.blinkAt) * 2) * 3 : 0;
    const eyes = blink ? 'closed' : eyesFor(f), cursor = typing && Math.sin(T * 7) > 0;
    const key = `${eyes}:${look}:${cursor}`;
    if (this.faceNow === key) return;
    this.faceNow = key;
    const g = this.faceCv.getContext('2d');
    if (!g) return;
    paintFace(g, eyes, this.family !== 'grok', look, cursor);
    this.faceTex.needsUpdate = true;
  }

  pop(k = 1) { this.squashV += 9 * k; }

  // Walk out of the chair toward a world point, then back. Purely a staging beat.
  walkTo(to: Point) {
    this.walk = { to: new THREE.Vector3(to.x - this.g.position.x, 0.2, to.z - this.g.position.z + 1.8), t: 0 };
  }

  redraw(a: FloorAgent, T: number) {
    const g = this.cv.getContext('2d');
    if (!g) return;
    drawMonitor(g, a, T);
    this.tex.needsUpdate = true;
  }

  animate(a: FloorAgent, T: number, real: number, focused: boolean) {
    this.setFamily(a.family);
    this.target.set(a.x, 0, a.z);
    this.g.position.lerp(this.target, Math.min(1, real * 4));
    const s = a.cheer ? 'cheer' : a.state, ph = a.phase, H0 = this.home;
    let hx = 0, hz = 0, al = -1.25, ar = -1.25, by = H0.y, rx = 0, ll = -1.3, lr = -1.3, tz = H0.z, tx = 0, ry = Math.PI;
    if (s === 'working') { al += Math.sin(T * 16 + ph) * 0.18; ar += Math.sin(T * 16 + ph + 2) * 0.18; hx = 0.12 + Math.sin(T * 3) * 0.08; rx = 0.1 + Math.sin(T * 5.5 + ph) * 0.07; by += Math.abs(Math.sin(T * 8 + ph)) * 0.09; ry += Math.sin(T * 1.7 + ph) * 0.14; }
    if (s === 'thinking') { ar = -2.1; hz = 0.2 + Math.sin(T * 1.3) * 0.16; hx = -0.25; al = -0.5; ry += Math.sin(T * 0.9 + ph) * 0.4; }
    if (s === 'reviewing') { hz = Math.sin(T * 1.4) * 0.35; ar = -1.5; al = -1.5; }
    if (s === 'blocked') { by = 0.2; tz = 2.7; ll = 0; lr = 0; ar = -2.9 + Math.sin(T * 11) * 0.4; al = -0.2; hx = -0.15; }
    if (s === 'silent') { rx = 0.35; hx = 0.75; al = -0.1; ar = -0.1; }
    if (s === 'asleep') { rx = 0.5; hx = 0.9; al = -1.5; ar = -1.5; by += Math.sin(T * 1.6) * 0.03; }
    if (s === 'paused') { al = 0; ar = 0; }
    if (s === 'finished') { rx = -0.22; hx = -0.2; al = -0.1; ar = -2.6 + Math.sin(T * 3 + ph) * 0.2; hz = Math.sin(T * 0.8 + ph) * 0.15; }
    if (s === 'waiting') { hz = Math.sin(T * 0.5 + ph) * 0.22; al = -0.25; ar = -0.25; rx = -0.1; by += Math.sin(T * 1.6 + ph) * 0.025; }
    if (s === 'cheer') { by = 0.2 + Math.abs(Math.sin(T * 8)); tz = 2.7; ll = Math.sin(T * 9) * 0.5; lr = -ll; al = -2.9 + Math.sin(T * 14) * 0.3; ar = -2.9 - Math.sin(T * 14) * 0.3; hx = -0.3; }
    let face: string = s;
    const fr = this.stroll.update(real, { worldX: a.x, worldZ: a.z, may: !focused && !this.walk && ROAMS.has(s), restless: s !== 'working' && s !== 'reviewing' });
    let strolling = false;
    if (fr.phase !== 'seated' && !this.walk) {
      strolling = true;
      tx = fr.x; tz = fr.z; rx = 0; hx = 0; hz = 0;
      if (fr.pose) { ({ by, al, ar, ll, lr, rx, hx, hz, ry } = strollPose(fr.pose, T, ph)); face = fr.pose; }
      else {
        const pace = T * 10 + ph;
        by = 0.2 + Math.abs(Math.sin(pace)) * 0.14; ll = Math.sin(pace) * 0.7; lr = -ll; al = -ll * 0.7; ar = ll * 0.7; ry = fr.heading; face = 'walking';
      }
    }
    if (this.walk) {
      const w = this.walk;
      w.t += real / 3.6;
      const out = w.t < 0.5 ? w.t * 2 : 2 - w.t * 2;
      const k = Math.min(1, out * 1.25);
      tx = w.to.x * k; tz = H0.z + (w.to.z - H0.z) * k; by = 0.2 + Math.abs(Math.sin(T * 10)) * 0.12;
      ll = Math.sin(T * 10) * 0.6; lr = -ll; al = -ll * 0.6; ar = ll * 0.6; rx = 0;
      ry = Math.atan2(w.to.x, w.to.z - H0.z) + (w.t < 0.5 ? 0 : Math.PI);
      face = 'walking';
      if (w.t >= 1) this.walk = null;
    }
    const L = Math.min(1, real * 9), { head, armL, armR, legL, legR, body } = this;
    head.rotation.x += (hx - head.rotation.x) * L; head.rotation.z += (hz - head.rotation.z) * L;
    armL.rotation.x += (al - armL.rotation.x) * L * 1.6; armR.rotation.x += (ar - armR.rotation.x) * L * 1.6;
    legL.rotation.x += (ll - legL.rotation.x) * L; legR.rotation.x += (lr - legR.rotation.x) * L;
    const direct = !!this.walk || strolling;
    body.position.x = direct ? tx : body.position.x + (tx - body.position.x) * L;
    body.position.y += (by - body.position.y) * L; body.position.z = direct ? tz : body.position.z + (tz - body.position.z) * L;
    body.rotation.x += (rx - body.rotation.x) * L;
    body.rotation.y += angleTo(body.rotation.y, ry) * L;
    // Spring squash: overshoot, return to rest. Volume stays constant so it reads as clay.
    this.squashV += (-this.squash * 120 - this.squashV * 12) * real;
    this.squash += this.squashV * real;
    const q = THREE.MathUtils.clamp(this.squash * 0.05, -0.35, 0.35);
    body.scale.set(1 - q / 2, 1 + q, 1 - q / 2);
    this.drawFace(face, T, s === 'working' && !strolling);
    if (this.formInfo?.tip) this.formInfo.tip.emissiveIntensity = s === 'blocked' ? 1.2 + Math.sin(T * 9) : 1 + Math.sin(T * 2 + ph) * 0.4;
    const st = STATE_LOOK[a.state] ?? STATE_LOOK.waiting;
    this.lamp.color.setHex(st.c); this.lamp.emissive.setHex(st.c);
    this.lamp.emissiveIntensity = a.state === 'blocked' || a.state === 'silent' ? 1 + Math.sin(T * 7) : 1;
    const k = focused ? 2.15 : 1;
    this.mon.scale.lerp(new THREE.Vector3(k, k, 1), 0.12);
    this.mon.position.y += ((focused ? 5.4 : 2.6) - this.mon.position.y) * 0.12;
  }

  dispose() { disposeTree(this.g); this.g.removeFromParent(); }
}
