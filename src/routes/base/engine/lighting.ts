import type * as THREE from 'three';

// 0 at noon, 1 in the dead of night, following the player's real clock.
export function nightFactor(hour: number): number {
  const d = Math.abs(((hour + 24) % 24) - 12);
  return Math.max(0, Math.min(1, (d - 5) / 3));
}

export function lightingAt(hour: number, pressure: number, hemi: THREE.HemisphereLight, sun: THREE.DirectionalLight) {
  const n = nightFactor(hour);
  hemi.intensity = 1.05 - n * 0.35;
  sun.intensity = 1.9 - n * 1.15;
  sun.color.setRGB(1 - n * 0.35, 0.886 - n * 0.2, 0.72 + n * 0.28);
  hemi.color.setRGB(1, 0.945 - pressure * 0.38, 0.86 - pressure * 0.5);
}
