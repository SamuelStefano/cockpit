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

// Pixel art stays crisp only on whole zoom levels: 1x, 2x, 3x...
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;

export const clampZoom = (z: number, min = MIN_ZOOM, max = MAX_ZOOM): number => Math.min(max, Math.max(min, Math.round(z)));

// One step per wheel notch or pinch gesture: positive dir zooms in.
export const stepZoom = (z: number, dir: number): number => clampZoom(Math.round(z) + Math.sign(dir));

// Wheel: scroll up (negative deltaY) zooms in.
export const wheelStep = (deltaY: number): number => (deltaY < 0 ? 1 : deltaY > 0 ? -1 : 0);

// Largest whole zoom that fits a world of (w, h) px into a viewport.
export function fitZoom(viewW: number, viewH: number, w: number, h: number, margin = 0): number {
  if (viewW <= 0 || viewH <= 0) return 1;
  return clampZoom(Math.floor(Math.min((viewW - margin) / w, (viewH - margin) / h)));
}

// Whole zoom for the first frame: fits the whole world when it can, otherwise the
// widest whole zoom that still shows `focusW` px (the plaza and the middle house).
export function initialZoom(viewW: number, viewH: number, worldW: number, worldH: number, focusW: number, focusH: number): number {
  const whole = fitZoom(viewW, viewH, worldW, worldH);
  const fits = Math.min(viewW / worldW, viewH / worldH) >= 1;
  return fits ? whole : fitZoom(viewW, viewH, focusW, focusH);
}

export function parseInitialMode(search: string): CameraMode {
  return new URLSearchParams(search).get('mode') === 'god' ? 'god' : 'avatar';
}

// ?focus=<house id>&zoom=3 opens god mode centred on one house (used for screenshots).
export function parseFocus(search: string): { house: string; zoom: number } | null {
  const q = new URLSearchParams(search);
  const house = q.get('focus');
  return house ? { house, zoom: clampZoom(Number(q.get('zoom')) || 3) } : null;
}

export const isDemo = (search: string): boolean => new URLSearchParams(search).get('demo') === '1';

export const demoMeeting = (search: string): boolean => new URLSearchParams(search).get('meeting') === '1';
