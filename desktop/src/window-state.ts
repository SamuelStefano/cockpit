export interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized: boolean;
}

// Below 1024 the web layout flips to mobile and drops the terminal.
export const MIN_WIDTH = 1024;
export const MIN_HEIGHT = 640;
const DEFAULT: WindowState = { width: 1440, height: 900, maximized: false };

export function parseWindowState(raw: string | null): WindowState {
  if (!raw) return DEFAULT;
  try {
    const v = JSON.parse(raw) as Partial<WindowState>;
    const num = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
    if (!num(v.width) || !num(v.height)) return DEFAULT;
    return {
      x: num(v.x) ? v.x : undefined,
      y: num(v.y) ? v.y : undefined,
      width: Math.max(v.width, MIN_WIDTH),
      height: Math.max(v.height, MIN_HEIGHT),
      maximized: v.maximized === true,
    };
  } catch {
    return DEFAULT;
  }
}
