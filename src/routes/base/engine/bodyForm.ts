import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { MASCOT_COLORS, MASCOT_SHAPES } from '../../../components/team/mascot-shapes';
import { box, ink, inkMat, newMat } from './kit';

export const BIT_ORANGE = 0xf97316;
export const BIT_LIMB = 0xc2410c;
const MASCOT_UNITS = 2.1, DEPTH = 34;

export interface FaceAnchor { x: number; y: number; z: number; size: number }
export interface BodyForm { face: FaceAnchor; tip: THREE.MeshStandardMaterial | null; limb: number; hideTorso: boolean }

const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

export function mascotOf(id: string) {
  const shapes = Object.keys(MASCOT_SHAPES) as (keyof typeof MASCOT_SHAPES)[], h = hash(id);
  return { shape: MASCOT_SHAPES[shapes[h % shapes.length]], color: MASCOT_COLORS[(Math.imul(h, 2654435761) >>> 13) % MASCOT_COLORS.length] };
}

// The Deck's Bit in clay: a terminal head with a screen on both sides and a glowing antenna.
export function buildBit(root: THREE.Object3D, tipColor: number): BodyForm {
  const head = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.15, 1.1, 3, 0.28), newMat(BIT_ORANGE));
  head.castShadow = true;
  ink(head, inkMat(), 1.06);
  root.add(head);
  box(root, 0.08, 0.42, 0.08, BIT_LIMB, 0, 0.76, 0);
  const tip = new THREE.MeshStandardMaterial({ color: tipColor, emissive: tipColor, emissiveIntensity: 1.2 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), tip);
  ball.position.y = 1.02;
  root.add(ball);
  return { face: { x: 0, y: 0, z: 0.56, size: 1.08 }, tip, limb: BIT_LIMB, hideTorso: false };
}

// The same silhouettes the Equipe screen uses for Grok bots, extruded from their real SVG path.
export function buildMascot(root: THREE.Object3D, id: string): BodyForm {
  const { shape, color } = mascotOf(id), hex = new THREE.Color(color).getHex();
  const parsed = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="${shape.body}"/></svg>`);
  const geo = new THREE.ExtrudeGeometry(SVGLoader.createShapes(parsed.paths[0]), { depth: DEPTH, bevelEnabled: true, bevelSize: 3, bevelThickness: 3, bevelSegments: 3, curveSegments: 18 });
  geo.translate(-32, -32, -DEPTH / 2);
  const mesh = new THREE.Mesh(geo, newMat(hex));
  const s = MASCOT_UNITS / 64;
  mesh.scale.set(s, -s, s);
  mesh.position.y = -0.85;
  mesh.castShadow = true;
  ink(mesh, inkMat(), 1.05);
  root.add(mesh);
  const size = ((shape.gap + 16) * s) * 1.6;
  return { face: { x: (shape.eyes[0] - 32) * s, y: -0.85 - (shape.eyes[1] - 32) * s, z: (DEPTH / 2 + 3) * s + 0.02, size }, tip: null, limb: hex, hideTorso: true };
}
