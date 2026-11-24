export const SLEEP_AFTER_MS = 180_000;
export const PET_CLICKS = 3;
export const PET_WINDOW_MS = 2000;
export const WAKE_MS = 900;
export const PET_MS = 1800;

// Rolling window of click times; `pet` is true on the click that completes the 3rd within the window.
export function registerClick(times: number[], now: number): { times: number[]; pet: boolean } {
  const recent = [...times.filter((t) => now - t <= PET_WINDOW_MS), now];
  return recent.length >= PET_CLICKS ? { times: [], pet: true } : { times: recent, pet: false };
}
