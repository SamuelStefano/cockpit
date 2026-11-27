/**
 * Pure decision logic of the screenshot offer: no React Native, no Expo import.
 *
 * `MediaSubtype` 'screenshot' and `Asset.creationTime` (ms since epoch) come from
 * expo-media-library 57 (`expo-media-library/legacy` types, checked in the published package).
 */
export const OFFER_WINDOW_MS = 10 * 60 * 1000;
/** Clock skew allowed for an asset stamped slightly in the future. */
const FUTURE_SKEW_MS = 60 * 1000;
export const MAX_IMAGE_SIDE = 1600;
export const THUMB_SIDE = 160;

export interface AssetLike {
  id: string;
  mediaType: string;
  mediaSubtypes?: readonly string[];
  /** ms since epoch (seconds are tolerated, see `toMs`). */
  creationTime: number;
  width?: number;
  height?: number;
}

/** What survives a relaunch: the first-enable time and the last asset we offered. */
export interface OfferState {
  since: number;
  lastId: string | null;
  lastTime: number;
}

export type OfferDecision = { offer: true } | { offer: false; reason: 'not-photo' | 'not-screenshot' | 'bad-time' | 'too-old' | 'already-offered' | 'before-install' };

/** A creation time in ms. Values below 1e11 are seconds (year 5138 in ms), so they are scaled. */
export function toMs(t: number): number {
  return t < 1e11 ? t * 1000 : t;
}

export function decideOffer(asset: AssetLike | null | undefined, state: OfferState, now: number): OfferDecision {
  if (!asset || asset.mediaType !== 'photo') return { offer: false, reason: 'not-photo' };
  if (!asset.mediaSubtypes?.includes('screenshot')) return { offer: false, reason: 'not-screenshot' };
  if (typeof asset.creationTime !== 'number' || !Number.isFinite(asset.creationTime) || asset.creationTime <= 0) return { offer: false, reason: 'bad-time' };
  const t = toMs(asset.creationTime);
  if (t > now + FUTURE_SKEW_MS) return { offer: false, reason: 'bad-time' };
  if (now - t > OFFER_WINDOW_MS) return { offer: false, reason: 'too-old' };
  if (asset.id === state.lastId || t <= state.lastTime) return { offer: false, reason: 'already-offered' };
  if (t <= state.since) return { offer: false, reason: 'before-install' };
  return { offer: true };
}

export function firstRunState(now: number): OfferState {
  return { since: now, lastId: null, lastTime: 0 };
}

export function recordOffer(state: OfferState, asset: AssetLike): OfferState {
  return { ...state, lastId: asset.id, lastTime: Math.max(state.lastTime, toMs(asset.creationTime)) };
}

export function serializeState(s: OfferState): string {
  return JSON.stringify(s);
}

/** Strict parse of the persisted state. Anything odd returns null (the caller treats it as a first run). */
export function parseState(raw: string | null | undefined): OfferState | null {
  if (typeof raw !== 'string' || raw.length > 1024) return null;
  try {
    const d: unknown = JSON.parse(raw);
    if (typeof d !== 'object' || d === null || Array.isArray(d)) return null;
    const { since, lastId, lastTime } = d as Record<string, unknown>;
    if (typeof since !== 'number' || !Number.isFinite(since) || since <= 0) return null;
    if (typeof lastTime !== 'number' || !Number.isFinite(lastTime) || lastTime < 0) return null;
    if (lastId !== null && typeof lastId !== 'string') return null;
    return { since, lastId, lastTime };
  } catch {
    return null;
  }
}

export type AccessStatus = 'granted' | 'limited' | 'denied' | 'undetermined';

/** Maps an expo-media-library PermissionResponse to what the web is told. */
export function accessStatus(p: { granted?: boolean; canAskAgain?: boolean; status?: string; accessPrivileges?: string }): AccessStatus {
  if (p.accessPrivileges === 'limited') return 'limited';
  if (p.granted || p.accessPrivileges === 'all') return 'granted';
  if (p.status === 'undetermined') return 'undetermined';
  return 'denied';
}

/** The resize action that fits the longest side in `max` (never upscales). Null = keep the size. */
export function fitWithin(width: number | undefined, height: number | undefined, max: number): { width: number } | { height: number } | null {
  if (!width || !height || width <= 0 || height <= 0) return { width: max };
  if (Math.max(width, height) <= max) return null;
  return width >= height ? { width: max } : { height: max };
}
