export const MISSION_XP_KEY = 'deck.missionRoom.xp';

export function loadMissionXp(): number {
  try {
    const n = Number(localStorage.getItem(MISSION_XP_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function saveMissionXp(xp: number): void {
  try {
    localStorage.setItem(MISSION_XP_KEY, String(xp));
  } catch {
    // storage unavailable: the total just stays in memory
  }
}
