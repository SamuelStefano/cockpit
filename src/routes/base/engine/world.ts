import * as THREE from 'three';
import { SECTORS, sectorCenter } from '../sectors';
import { BELT } from '../sim-types';
import type { SectorId, Station } from '../types';
import { box, cyl, disposeTree, newMat, PAL, setSpriteText, sign } from './kit';

const MOUNTAIN_MAX = 70;

function plant(p: THREE.Object3D, x: number, z: number) {
  cyl(p, 0.5, 0.38, 0.8, PAL.terra, x, 0.4, z);
  for (let i = 0; i < 6; i++) {
    const l = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.5, 5), newMat(PAL.green));
    l.position.set(x + Math.cos(i) * 0.3, 1.5, z + Math.sin(i) * 0.3);
    l.rotation.set(Math.sin(i) * 0.5, 0, -Math.cos(i) * 0.5);
    l.castShadow = true;
    p.add(l);
  }
}

function floorTiles(p: THREE.Object3D) {
  const tiles: [number, number][] = [];
  for (let x = -66; x < 66; x += 4) for (let z = -15; z < 15; z += 4) if ((Math.round((x + 66) / 4) + Math.round((z + 15) / 4)) % 2 === 0) tiles.push([x + 2, z + 2]);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(3.94, 0.02, 3.94), newMat(PAL.floor2), tiles.length);
  const o = new THREE.Object3D();
  tiles.forEach(([x, z], i) => { o.position.set(x, 0.01, z); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
  im.receiveShadow = true;
  p.add(im);
}

export class World {
  readonly root = new THREE.Group();
  readonly sectorZones = new Map<SectorId, THREE.MeshBasicMaterial>();
  private portal: THREE.Mesh;
  private machineScreen: THREE.Mesh;
  private machineLabel: THREE.Sprite;
  private gears: THREE.Mesh[];
  private racks: { name: string; group: THREE.Group; leds: THREE.Mesh[]; label: THREE.Sprite }[] = [];
  private clockHand: THREE.Mesh;
  private clockLabel: THREE.Sprite;
  private mountainMesh: THREE.InstancedMesh;
  private mountainLabel: THREE.Sprite;
  private postBoard: THREE.Mesh;
  private postSign: THREE.Sprite;
  private slats: THREE.Mesh[] = [];
  private slatX = 0;
  private gateBars = new THREE.Group();
  private stationGroup = new THREE.Group();
  private stationKey = '';

  constructor(scene: THREE.Scene) {
    const r = this.root;
    scene.add(r);
    box(r, 132, 1, 30, PAL.floor, 0, -0.5, 0);
    floorTiles(r);
    box(r, 132, 6, 0.8, PAL.wall, 0, 3, -15);
    box(r, 0.8, 6, 30, PAL.wall, -66, 3, 0);
    for (let x = -60; x < 66; x += 7) {
      box(r, 3.6, 2.2, 0.15, 0x7ea7b0, x, 3.7, -14.5, { emissive: 0x9fc4c8, emissiveIntensity: 0.25 });
      box(r, 3.9, 0.15, 0.3, PAL.woodDark, x, 2.55, -14.45);
    }
    ([[-64, 1], [-47, -13], [-47, 13], [64, -13], [64, 13]] as const).forEach(([x, z]) => plant(r, x, z));
    this.buildSectors();

    box(r, 1.2, 4.6, 0.8, PAL.woodDark, -65, 2.3, -10.5); box(r, 1.2, 4.6, 0.8, PAL.woodDark, -65, 2.3, -5.5); box(r, 1.3, 0.8, 5.8, PAL.woodDark, -65, 4.8, -8);
    this.portal = box(r, 0.2, 4.2, 4.2, 0xffd98a, -65.1, 2.2, -8, { emissive: 0xffb84d, emissiveIntensity: 1.1 });
    sign(r, 'PROMPTS IN', -63.5, 6.2, -8);
    box(r, 1.6, 1.6, 1, PAL.char, -60, 0.8, -12.5);
    box(r, 1.3, 0.8, 0.08, 0x1e2a2e, -60, 1.2, -11.97, { emissive: 0xe2b23c, emissiveIntensity: 0.5 });
    sign(r, 'COMPOSER', -60, 3, -12.5, 2.6);

    const machine = new THREE.Group();
    machine.position.set(53, 0, -10);
    r.add(machine);
    box(machine, 5, 3.2, 3, PAL.metal, 0, 1.6, 0);
    this.machineScreen = box(machine, 3.6, 1.3, 0.1, 0x1e2a2e, 0, 2.1, 1.55, { emissive: 0x2f7f79, emissiveIntensity: 0.7 });
    this.gears = [cyl(machine, 0.8, 0.8, 0.4, PAL.gold, -1.2, 3.6, 0), cyl(machine, 0.6, 0.6, 0.4, PAL.terra, 0.5, 3.6, 0.2)];
    this.machineLabel = sign(r, 'SKILLS + MCP', 53, 5.8, -10, 4);

    box(r, 3, 3, 0.3, PAL.char, 62, 3.5, -14.2);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.1, 24), new THREE.MeshStandardMaterial({ color: 0xf4ead6 }));
    face.rotation.x = Math.PI / 2; face.position.set(62, 3.5, -14);
    r.add(face);
    this.clockHand = box(r, 0.12, 1, 0.06, PAL.ink, 62, 3.5, -13.9);
    this.clockLabel = sign(r, 'NEXT RUN UNKNOWN', 62, 5.9, -13.6, 4.4);

    const pile = new THREE.Group();
    pile.position.set(-56, 0, 10);
    r.add(pile);
    this.mountainMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), newMat(PAL.wood), MOUNTAIN_MAX);
    this.mountainMesh.castShadow = true;
    const o = new THREE.Object3D();
    // Fixed seed: the pile keeps its shape, and only `count` says how much of it is real.
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const order = Array.from({ length: MOUNTAIN_MAX }, () => { const ang = rnd() * 6.28, rad = rnd() * 3.6; return { ang, rad, h: (3.6 - rad) * 0.9 * rnd() }; }).sort((a, b) => a.h - b.h);
    order.forEach(({ ang, rad, h }, i) => {
      o.position.set(Math.cos(ang) * rad, 0.35 + h, Math.sin(ang) * rad * 0.5);
      o.rotation.set(rnd() * 0.3, rnd() * 3, rnd() * 0.3);
      o.updateMatrix();
      this.mountainMesh.setMatrixAt(i, o.matrix);
    });
    pile.add(this.mountainMesh);
    this.mountainLabel = sign(r, 'BOARD NOT LOADED', -56, 6.2, 10, 7);

    this.postBoard = box(r, 3, 2.4, 0.2, 0xf2c14e, -65, 2.2, 5);
    this.postBoard.rotation.y = Math.PI / 2;
    this.postSign = sign(r, 'SCHEDULED POST', -63.5, 4.3, 5, 3.2);

    box(r, BELT.x1 - BELT.x0 + 2, 0.7, 2.6, PAL.belt, (BELT.x0 + BELT.x1) / 2, 0.35, BELT.z);
    for (let i = 0; i < 100; i++) this.slats.push(box(r, 0.16, 0.05, 2.3, 0x5e5c62, BELT.x0 + i * 0.95, 0.73, BELT.z));
    this.gateBars.position.set(0, -3.2, BELT.z);
    r.add(this.gateBars);
    for (const z of [-1, -0.33, 0.33, 1]) box(this.gateBars, 0.25, 2.8, 0.25, PAL.red, 0, 2, z);
    box(r, 2, 0.5, 11, PAL.woodDark, 58, 0.25, 9.5);
    r.add(this.stationGroup);
  }

  private buildSectors() {
    for (const s of SECTORS) {
      const w = s.x1 - s.x0, d = s.z1 - s.z0, c = sectorCenter(s);
      const m = new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.09, depthWrite: false });
      const zone = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, d - 0.4), m);
      zone.rotation.x = -Math.PI / 2;
      zone.position.set(c.x, 0.04, c.z);
      this.root.add(zone);
      this.sectorZones.set(s.id, m);
      for (const [lx, lz, lw, ld] of [[c.x, s.z1 - 0.2, w, 0.16], [c.x, s.z0 + 0.2, w, 0.16], [s.x0 + 0.2, c.z, 0.16, d], [s.x1 - 0.2, c.z, 0.16, d]] as const) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(lw, ld), new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.75 }));
        line.rotation.x = -Math.PI / 2;
        line.position.set(lx, 0.05, lz);
        this.root.add(line);
      }
    }
  }

  setDim(active: SectorId | null) {
    for (const [id, m] of this.sectorZones) m.opacity = active === null ? 0.09 : id === active ? 0.22 : 0.02;
  }

  setStations(stations: Station[]) {
    const key = stations.map((s) => `${s.label}@${s.x}`).join();
    if (key === this.stationKey) return;
    this.stationKey = key;
    disposeTree(this.stationGroup);
    this.stationGroup.clear();
    for (const st of stations) {
      box(this.stationGroup, 0.45, 3.5, 0.45, PAL.woodDark, st.x, 1.75, BELT.z + 1.5);
      box(this.stationGroup, 0.45, 3.5, 0.45, PAL.woodDark, st.x, 1.75, BELT.z - 1.5);
      box(this.stationGroup, 0.6, 0.45, 3.5, PAL.woodDark, st.x, 3.6, BELT.z);
      sign(this.stationGroup, st.label, st.x, 4.7, BELT.z, 3.2);
    }
  }

  setRacks(racks: { name: string; disk: number | null; label: string }[]) {
    for (const r of this.racks) if (!racks.some((x) => x.name === r.name)) { disposeTree(r.group); r.group.removeFromParent(); }
    this.racks = this.racks.filter((r) => racks.some((x) => x.name === r.name));
    racks.forEach((r, i) => {
      let view = this.racks.find((v) => v.name === r.name);
      if (!view) {
        const group = new THREE.Group();
        group.position.set(50 + i * 7, 0, -1);
        this.root.add(group);
        box(group, 2.6, 4.6, 1.8, PAL.char, 0, 2.3, 0);
        const leds = Array.from({ length: 6 }, (_, k) => box(group, 0.26, 0.26, 0.05, 0xffffff, -0.5 + (k % 2), 1.1 + Math.floor(k / 2) * 1.1, 0.92, { emissive: 0x58c26a, emissiveIntensity: 1 }));
        view = { name: r.name, group, leds, label: sign(group, r.label, 0, 5.3, 0, 3.4) };
        this.racks.push(view);
      }
      setSpriteText(view.label, r.label, 3.4);
    });
  }

  update(real: number, T: number, f: { gateBarsUp: boolean; machineOk: boolean | null; machineSpin: boolean; machineLabel: string; racks: { name: string; disk: number | null }[]; clockLabel: string; mountainCount: number; mountainLabel: string; postBoard: number | null; beltMoving: boolean }) {
    (this.portal.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.9 + Math.sin(T * 2) * 0.25;
    const spin = f.machineSpin && f.machineOk === true ? 1 : 0;
    this.gears[0].rotation.y += real * 2 * spin;
    this.gears[1].rotation.y -= real * 3 * spin;
    (this.machineScreen.material as THREE.MeshStandardMaterial).emissive.setHex(f.machineOk === null ? 0x3a3a44 : f.machineOk ? 0x2f7f79 : 0xd2402f);
    setSpriteText(this.machineLabel, f.machineLabel, 4);
    setSpriteText(this.clockLabel, f.clockLabel, 4.4);
    const now = new Date();
    this.clockHand.rotation.z = -((now.getHours() % 12) + now.getMinutes() / 60) * (Math.PI / 6);
    this.slatX = (this.slatX + real * 4.5 * (f.beltMoving ? 1 : 0)) % 0.95;
    this.slats.forEach((s, i) => { s.position.x = BELT.x0 + ((i * 0.95 + this.slatX) % (BELT.x1 - BELT.x0)); });
    this.gateBars.position.y += ((f.gateBarsUp ? 0 : -3.2) - this.gateBars.position.y) * Math.min(1, real * 5);
    for (const r of this.racks) {
      const disk = f.racks.find((x) => x.name === r.name)?.disk ?? null;
      r.leds.forEach((l, i) => {
        const on = disk !== null && Math.sin(T * (4 + i) + i * 2) > -0.4;
        const m = l.material as THREE.MeshStandardMaterial;
        m.emissive.setHex(disk === null ? 0x5a5a62 : disk > 0.9 && i < 2 ? 0xe5432f : 0x58c26a);
        m.emissiveIntensity = disk === null ? 0.3 : on ? 1.2 : 0.15;
      });
    }
    this.mountainMesh.count = Math.min(MOUNTAIN_MAX, Math.max(0, f.mountainCount));
    setSpriteText(this.mountainLabel, f.mountainLabel, 7);
    this.postBoard.visible = this.postSign.visible = f.postBoard !== null;
    if (f.postBoard !== null) (this.postBoard.material as THREE.MeshStandardMaterial).color.setHex(f.postBoard);
  }

  dispose() { disposeTree(this.root); }
}
