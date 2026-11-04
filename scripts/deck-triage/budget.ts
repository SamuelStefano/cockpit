const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export const MSG_HOURLY = 6;
export const MSG_DAILY = 12;

// Shared cap for the non-outage messages (triage, user-side). take() both checks and spends.
export function createBudget(now: () => number = Date.now, perHour = MSG_HOURLY, perDay = MSG_DAILY) {
  let times: number[] = [];
  let suppressed = 0;
  return {
    take(): boolean {
      const t = now();
      times = times.filter((x) => t - x < DAY_MS);
      if (times.filter((x) => t - x < HOUR_MS).length >= perHour || times.length >= perDay) {
        suppressed++;
        return false;
      }
      times.push(t);
      return true;
    },
    suppressed: () => suppressed,
  };
}
