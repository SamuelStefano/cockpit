import * as THREE from 'three';
import type { Point, Wing } from '../types';
import { sectorCenter, sectorById } from '../sectors';
import type { SectorId } from '../types';

// World is ~132 wide; the fleet shot backs off until it all fits the viewport's aspect.
export function fleetDistance(aspect: number): number {
  return Math.max(112, 150 / Math.max(aspect, 0.5));
}

export class Rig {
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 500);
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3(0, 0, 1);
  readonly tPos = new THREE.Vector3();
  readonly tLook = new THREE.Vector3(0, 0, 1);
  private shake = 0;
  private fleetD = 112;

  constructor() { this.fleetTarget(); this.pos.copy(this.tPos); }

  private fleetTarget() {
    const d = this.fleetD;
    this.tPos.set(0, d, d * 0.98);
    this.tLook.set(0, 0, 1);
  }
  resize(w: number, h: number) {
    const atFleet = this.tPos.distanceTo(this.tLook) >= this.fleetD * 1.3;
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.fleetD = fleetDistance(this.camera.aspect);
    if (atFleet) this.fleetTarget();
  }
  home() { this.fleetTarget(); }
  wing(w: Pick<Wing, 'cx' | 'width'>) {
    const d = Math.max(30, w.width * 1.15);
    this.tPos.set(w.cx, d * 0.95, d + 4);
    this.tLook.set(w.cx, 0, -3);
  }
  sector(id: SectorId) {
    const s = sectorById(id), c = sectorCenter(s), d = Math.max(30, (s.x1 - s.x0) * 0.95);
    this.tPos.set(c.x, d * 0.9, c.z + d);
    this.tLook.set(c.x, 0, c.z);
  }
  fly(p: Point) { this.tPos.set(p.x, 24, p.z + 27); this.tLook.set(p.x, 1, p.z); }
  desk(p: Point) { this.tPos.set(p.x, 5.7, p.z + 8.4); this.tLook.set(p.x, 5.1, p.z - 0.65); }
  addShake(v: number) { this.shake = Math.max(this.shake, v); }
  pan(dx: number, dz: number) { this.tPos.x += dx; this.tLook.x += dx; this.tPos.z += dz; this.tLook.z += dz; }
  zoom(k: number) {
    const off = this.tPos.clone().sub(this.tLook).multiplyScalar(k), len = off.length();
    if (len < 18 || len > 220) return;
    this.tPos.copy(this.tLook).add(off);
  }
  get zoomed() { return this.pos.distanceTo(this.look) < 90; }
  get height() { return this.pos.y; }

  update(real: number, T: number) {
    const k = Math.min(1, real * 4.5);
    this.pos.lerp(this.tPos, k);
    this.look.lerp(this.tLook, k);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - real * 1.6);
      this.camera.position.x += Math.sin(T * 47) * this.shake * 0.5;
      this.camera.position.y += Math.sin(T * 61) * this.shake * 0.35;
    }
  }
}
