import * as THREE from 'three';

export const PAL = { floor: 0xd8c7a6, floor2: 0xc9b690, wall: 0xc9b797, wood: 0xa8744a, woodDark: 0x6e4a30, belt: 0x3c3a3f, metal: 0x8d9299, teal: 0x2f7f79, terra: 0xc8603c, blue: 0x3f6fa8, char: 0x35343a, gold: 0xe2b23c, green: 0x4f9d58, red: 0xd2402f, violet: 0x7d5bbe, ink: 0x1b1a20 };

type MatOpts = THREE.MeshStandardMaterialParameters;

export const newMat = (color: number, o: MatOpts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.82, flatShading: true, ...o });
export const inkMat = () => new THREE.MeshBasicMaterial({ color: PAL.ink, side: THREE.BackSide });

// Inverted hull: the ink line that separates characters and crates from the room.
export function ink(mesh: THREE.Mesh, material: THREE.Material, s = 1.09): THREE.Mesh {
  const o = new THREE.Mesh(mesh.geometry, material);
  o.scale.setScalar(s);
  mesh.add(o);
  return o;
}

export function box(parent: THREE.Object3D, w: number, h: number, d: number, color: number | THREE.Material, x = 0, y = 0, z = 0, o?: MatOpts): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'number' ? newMat(color, o) : color);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function cyl(parent: THREE.Object3D, rt: number, rb: number, h: number, color: number, x = 0, y = 0, z = 0, seg = 8): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), newMat(color));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

// Canvas text is safe for untrusted titles: it never reaches the DOM as markup.
export function textSprite(text: string, w = 3.4, color = '#2b2a33', bg = '#f4ead6'): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial());
  setSpriteText(s, text, w, color, bg);
  return s;
}

export function setSpriteText(s: THREE.Sprite, text: string, w = 3.4, color = '#2b2a33', bg = '#f4ead6') {
  if (s.userData.text === text) return;
  s.userData.text = text;
  const c = document.createElement('canvas');
  c.width = 400; c.height = 80;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, 392, 72, 10); g.fill();
    g.fillStyle = color;
    let fs = 36;
    do { g.font = `800 ${fs}px "Trebuchet MS",sans-serif`; fs -= 2; } while (g.measureText(text).width > 370 && fs > 10);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 200, 42);
  }
  s.material.map?.dispose();
  s.material.map = new THREE.CanvasTexture(c);
  s.material.needsUpdate = true;
  s.scale.set(w, w / 5, 1);
}

export function sign(parent: THREE.Object3D, text: string, x: number, y: number, z: number, w?: number): THREE.Sprite {
  const s = textSprite(text, w);
  s.position.set(x, y, z);
  parent.add(s);
  return s;
}

export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose?.();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      (mat as THREE.MeshStandardMaterial).map?.dispose();
      mat.dispose();
    }
  });
}
