export type CameraMode = 'avatar' | 'god';

export interface WorldUi { mode: CameraMode; recording: boolean }

export type WorldUiAction =
  | { t: 'toggle-mode' }
  | { t: 'set-mode'; mode: CameraMode }
  | { t: 'toggle-recording' }
  | { t: 'exit-recording' };

export const initialWorldUi = (mode: CameraMode = 'avatar'): WorldUi => ({ mode, recording: false });

export function worldUiReducer(s: WorldUi, a: WorldUiAction): WorldUi {
  switch (a.t) {
    case 'toggle-mode': return { ...s, mode: s.mode === 'avatar' ? 'god' : 'avatar' };
    case 'set-mode': return s.mode === a.mode ? s : { ...s, mode: a.mode };
    case 'toggle-recording': return { ...s, recording: !s.recording };
    case 'exit-recording': return s.recording ? { ...s, recording: false } : s;
  }
}

export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 5;

export const clampZoom = (z: number, min = MIN_ZOOM, max = MAX_ZOOM): number => Math.min(max, Math.max(min, z));

// Wheel step: scroll up (negative deltaY) zooms in. Exponential, so it feels even at any zoom.
export const wheelZoom = (z: number, deltaY: number): number => clampZoom(z * Math.exp(-deltaY * 0.0012));

// Zoom that fits a world of (w, h) px into a viewport, with a margin in px.
export function fitZoom(viewW: number, viewH: number, w: number, h: number, margin = 24): number {
  if (viewW <= 0 || viewH <= 0) return 1;
  return clampZoom(Math.min((viewW - margin) / w, (viewH - margin) / h));
}

export function parseInitialMode(search: string): CameraMode {
  return new URLSearchParams(search).get('mode') === 'god' ? 'god' : 'avatar';
}

export const isDemo = (search: string): boolean => new URLSearchParams(search).get('demo') === '1';
