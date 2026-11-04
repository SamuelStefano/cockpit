import * as THREE from 'three';
import type { Mission, MissionSize } from '../missions';
import { box, newMat, PAL } from './kit';
import { layoutWall, WALL, wrapTitle, type WallEntry } from './missionWallLayout';

const CW = 640;
const CH = 340;
const OFF_TIME = 0.5;
const ON_TIME = 0.35;
const SIZE_COLOR: Record<MissionSize, string> = { S: '#59c2ba', M: '#e2b23c', L: '#e07a55' };
const SIZE_HEX: Record<MissionSize, number> = { S: 0x59c2ba, M: 0xe2b23c, L: 0xe07a55 };
const GOLD = 0xffd25a;

type Burst = (x: number, y: number, z: number, color: number, n: number, up: number) => void;

interface Screen {
  entry: WallEntry;
  group: THREE.Group;
  frame: THREE.Mesh;
  face: THREE.Mesh;
  tex: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  beacon: THREE.Mesh | null;
  drawKey: string;
  target: THREE.Vector3;
  age: number; // seconds since power-on
  dying: number | null; // seconds since power-off started
  phase: number;
}

const entryColor = (e: WallEntry): number => (e.kind === 'mission' ? SIZE_HEX[e.mission.size] : 0x59c2ba);
const drawKeyOf = (e: WallEntry): string => {
  if (e.kind === 'mission') { const m = e.mission; return `m|${m.title}|${m.size}|${m.xp}|${m.suggested}|${m.status}`; }
  return e.kind === 'more' ? `more|${e.count}` : 'idle';
};

function drawScreen(canvas: HTMLCanvasElement, e: WallEntry) {
  const g = canvas.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, CW, CH);
  g.fillStyle = '#13181c'; g.fillRect(0, 0, CW, CH);
  g.textBaseline = 'middle';
  if (e.kind === 'idle') {
    g.fillStyle = '#59c2ba'; g.font = '800 44px "Trebuchet MS",sans-serif'; g.textAlign = 'center';
    g.fillText('No missions', CW / 2, CH / 2 - 26);
    g.fillStyle = '#9fb3b0'; g.font = '700 30px "Trebuchet MS",sans-serif';
    g.fillText('All clear', CW / 2, CH / 2 + 26);
    g.strokeStyle = '#2f7f79'; g.lineWidth = 6; g.strokeRect(10, 10, CW - 20, CH - 20);
    return;
  }
  if (e.kind === 'more') {
    g.fillStyle = '#e2b23c'; g.font = '800 96px "Trebuchet MS",sans-serif'; g.textAlign = 'center';
    g.fillText(`+${e.count}`, CW / 2, CH / 2 - 20);
    g.fillStyle = '#9fb3b0'; g.font = '800 34px "Trebuchet MS",sans-serif';
    g.fillText('more missions', CW / 2, CH / 2 + 60);
    g.strokeStyle = '#4a4a55'; g.lineWidth = 6; g.setLineDash([18, 12]); g.strokeRect(10, 10, CW - 20, CH - 20); g.setLineDash([]);
    return;
  }
  const m: Mission = e.mission, accent = SIZE_COLOR[m.size];
  g.fillStyle = accent; g.fillRect(0, 0, CW, 14);
  g.textAlign = 'left';
  g.fillStyle = m.status === 'doing' ? '#58c26a' : '#9fb3b0'; g.font = '800 22px monospace';
  g.fillText(m.status === 'doing' ? '● IN PROGRESS' : '○ TO DO', 24, 44);
  if (m.suggested) { g.textAlign = 'right'; g.fillStyle = '#ffd25a'; g.fillText('★ SUGGESTED', CW - 24, 44); }
  g.textAlign = 'left'; g.fillStyle = '#f4ead6'; g.font = '800 46px "Trebuchet MS",sans-serif';
  const lines = wrapTitle((s) => g.measureText(s).width, m.title || 'Untitled', CW - 48, 2);
  lines.forEach((l, i) => g.fillText(l, 24, 118 + i * 56));
  g.fillStyle = accent; g.beginPath(); g.arc(62, CH - 52, 34, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#13181c'; g.font = '800 44px "Trebuchet MS",sans-serif'; g.textAlign = 'center';
  g.fillText(m.size, 62, CH - 50);
  g.textAlign = 'right'; g.fillStyle = '#ffd25a'; g.font = '800 44px "Trebuchet MS",sans-serif';
  g.fillText(`+${m.xp} XP`, CW - 24, CH - 50);
  if (m.suggested) { g.strokeStyle = '#ffd25a'; g.lineWidth = 6; g.strokeRect(3, 3, CW - 6, CH - 6); }
}

export class MissionWall {
  readonly root = new THREE.Group();
  private screens = new Map<string, Screen>();
  private selected: string | null = null;

  constructor(parent: THREE.Object3D, private burst: Burst) {
    parent.add(this.root);
    const wallW = WALL.cols * WALL.pitchX + 2, wallH = 9.4;
    box(this.root, wallW, wallH, 0.4, 0x3a3640, WALL.cx, wallH / 2, WALL.z - 0.3);
    box(this.root, wallW + 0.6, 0.35, 0.7, PAL.woodDark, WALL.cx, wallH + 0.17, WALL.z - 0.2);
    box(this.root, wallW + 0.6, 0.3, 1.1, PAL.woodDark, WALL.cx, 0.15, WALL.z + 0.1);
  }

  setSelected(id: string | null) { this.selected = id; }

  set(missions: Mission[]) {
    const entries = layoutWall(missions), keep = new Set(entries.map((e) => e.key));
    for (const [key, s] of this.screens) if (!keep.has(key) && s.dying === null) this.kill(s, key);
    for (const e of entries) {
      let s = this.screens.get(e.key);
      if (s && s.dying !== null) { this.destroy(s); this.screens.delete(e.key); s = undefined; }
      if (!s) { s = this.create(e); this.screens.set(e.key, s); }
      s.entry = e;
      s.target.set(e.x, e.y, WALL.z);
      const key = drawKeyOf(e);
      if (key !== s.drawKey) {
        s.drawKey = key;
        drawScreen(s.canvas, e);
        s.tex.needsUpdate = true;
        this.syncBeacon(s);
      }
    }
  }

  private create(e: WallEntry): Screen {
    const group = new THREE.Group();
    group.position.set(e.x, e.y, WALL.z);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(e.w + 0.3, e.h + 0.3, 0.14), newMat(PAL.char, { emissive: 0x000000 }));
    frame.castShadow = false;
    const canvas = document.createElement('canvas');
    canvas.width = CW; canvas.height = CH;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.8, roughness: 0.6 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(e.w, e.h), mat);
    face.position.z = 0.08;
    group.add(frame, face);
    this.root.add(group);
    if (e.kind === 'mission') { frame.userData.missionId = e.key; face.userData.missionId = e.key; }
    return { entry: e, group, frame, face, tex, canvas, beacon: null, drawKey: '', target: new THREE.Vector3(e.x, e.y, WALL.z), age: 0, dying: null, phase: Math.random() * 6 };
  }

  private syncBeacon(s: Screen) {
    const want = s.entry.kind === 'mission' && s.entry.mission.suggested;
    if (want && !s.beacon) {
      s.beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.36), new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 1.2, flatShading: true }));
      s.group.add(s.beacon);
    } else if (!want && s.beacon) {
      s.beacon.removeFromParent();
      s.beacon.geometry.dispose();
      (s.beacon.material as THREE.Material).dispose();
      s.beacon = null;
    }
  }

  private kill(s: Screen, key: string) {
    s.dying = 0;
    s.frame.userData.missionId = undefined;
    s.face.userData.missionId = undefined;
    if (s.entry.kind !== 'mission') { this.destroy(s); this.screens.delete(key); }
  }

  private destroy(s: Screen) {
    s.group.removeFromParent();
    s.frame.geometry.dispose();
    (s.frame.material as THREE.Material).dispose();
    s.face.geometry.dispose();
    const m = s.face.material as THREE.MeshStandardMaterial;
    m.dispose();
    s.tex.dispose();
    if (s.beacon) { s.beacon.geometry.dispose(); (s.beacon.material as THREE.Material).dispose(); }
  }

  update(real: number, T: number) {
    for (const [key, s] of this.screens) {
      const mat = s.face.material as THREE.MeshStandardMaterial, fmat = s.frame.material as THREE.MeshStandardMaterial;
      if (s.dying !== null) {
        s.dying += real;
        const t = s.dying / OFF_TIME;
        // CRT power-off: collapse to a line, then to a dot, then burst.
        s.group.scale.set(t < 0.5 ? 1 : Math.max(0.001, 1 - (t - 0.5) * 2), t < 0.5 ? Math.max(0.03, 1 - t * 2) : 0.03, 1);
        mat.emissiveIntensity = 0.8 + t * 2;
        if (t >= 1) {
          const e = s.entry;
          this.burst(e.x, e.y, WALL.z + 0.8, entryColor(e), 22, 6);
          this.burst(e.x, e.y, WALL.z + 0.8, 0xffffff, 8, 8);
          this.destroy(s);
          this.screens.delete(key);
        }
        continue;
      }
      s.age += real;
      s.group.position.lerp(s.target, Math.min(1, real * 6));
      const on = Math.min(1, s.age / ON_TIME);
      s.group.scale.set(1, on < 1 ? 0.03 + 0.97 * on * on : 1, 1);
      const suggested = s.entry.kind === 'mission' && s.entry.mission.suggested;
      const pulse = Math.sin(T * 3 + s.phase);
      mat.emissiveIntensity = (suggested ? 1.25 + pulse * 0.35 : 0.8 + pulse * 0.04) * (on < 1 ? 0.5 + 0.5 * Math.sin(s.age * 90) : 1);
      const sel = s.entry.kind === 'mission' && s.entry.key === this.selected;
      fmat.color.setHex(sel ? GOLD : suggested ? 0x8a6a1c : PAL.char);
      fmat.emissive.setHex(sel ? GOLD : 0x000000);
      fmat.emissiveIntensity = sel ? 0.9 + Math.sin(T * 6) * 0.3 : 0;
      s.frame.scale.set(sel ? 1.04 : 1, sel ? 1.07 : 1, sel ? 1.8 : 1);
      if (s.beacon) {
        s.beacon.position.set(0, s.entry.h / 2 + 0.75 + Math.sin(T * 2.4 + s.phase) * 0.18, 0.7);
        s.beacon.rotation.y = T * 1.6;
      }
    }
  }

  dispose() {
    for (const s of this.screens.values()) this.destroy(s);
    this.screens.clear();
    for (const o of [...this.root.children]) {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose();
    }
    this.root.removeFromParent();
  }
}
