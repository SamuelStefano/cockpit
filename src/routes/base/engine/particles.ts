import * as THREE from 'three';

interface Part { m: THREE.Mesh; v: THREE.Vector3; life: number; spin: number }

export class Particles {
  private geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  private parts: Part[] = [];
  constructor(private scene: THREE.Scene) {}

  burst(x: number, y: number, z: number, color: number, n = 14, up = 7) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color }));
      m.position.set(x, y, z);
      this.scene.add(m);
      const ang = Math.random() * 6.28, sp = 1.5 + Math.random() * 4;
      this.parts.push({ m, v: new THREE.Vector3(Math.cos(ang) * sp, up * (0.5 + Math.random() * 0.7), Math.sin(ang) * sp), life: 0.8 + Math.random() * 0.6, spin: Math.random() * 9 });
    }
  }

  step(dt: number) {
    this.parts = this.parts.filter((p) => {
      p.life -= dt; p.v.y -= 16 * dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.rotation.x += p.spin * dt;
      if (p.m.position.y < 0.15) { p.m.position.y = 0.15; p.v.y *= -0.45; p.v.x *= 0.6; p.v.z *= 0.6; }
      p.m.scale.setScalar(Math.min(1, p.life * 2.5));
      if (p.life > 0) return true;
      this.kill(p);
      return false;
    });
  }

  private kill(p: Part) { p.m.removeFromParent(); (p.m.material as THREE.Material).dispose(); }
  dispose() { this.parts.forEach((p) => this.kill(p)); this.parts = []; this.geo.dispose(); }
}
