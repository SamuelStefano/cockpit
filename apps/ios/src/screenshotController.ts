/**
 * The screenshot offer flow with every device call injected, so it is tested in plain Node.
 * The Expo wiring lives in `screenshotsNative.ts`.
 *
 * Nothing reads Photos until `enable()` (the web sends it only after the user opts in).
 * The full image leaves the device library only after `accept(id)`.
 */
import { decideOffer, firstRunState, recordOffer, type AccessStatus, type AssetLike, type OfferState } from './screenshotOffer';
import type { ShellEvent } from './shellEvents';

export interface ScreenshotDeps {
  now(): number;
  /** Current Photos access without prompting. */
  getAccess(): Promise<AccessStatus>;
  /** Shows the system prompt (only called from `enable`). Resolves to the new status. */
  requestAccess(): Promise<AccessStatus>;
  /** The newest screenshot asset, or null. */
  latestScreenshot(): Promise<AssetLike | null>;
  makeThumbnail(asset: AssetLike): Promise<string>;
  makeFullImage(asset: AssetLike): Promise<string>;
  loadState(): Promise<OfferState | null>;
  saveState(state: OfferState): Promise<void>;
  /** Delivers an event to the web page. Must drop it when the page is not the trusted origin. */
  send(event: ShellEvent): void;
}

export function createScreenshotController(deps: ScreenshotDeps) {
  let enabled = false;
  let state: OfferState | null = null;
  let pending: AssetLike | null = null;
  let busy = false;

  async function ensureState(): Promise<OfferState> {
    if (state) return state;
    state = (await deps.loadState()) ?? firstRunState(deps.now());
    await deps.saveState(state);
    return state;
  }

  async function check(): Promise<void> {
    if (!enabled || busy) return;
    busy = true;
    try {
      const access = await deps.getAccess();
      if (access === 'denied' || access === 'undetermined') return deps.send({ type: 'screenshots-status', status: access });
      const current = await ensureState();
      const asset = await deps.latestScreenshot();
      if (!decideOffer(asset, current, deps.now()).offer || !asset) return;
      // Recorded before the offer: a dismissed or ignored print is never offered twice.
      state = recordOffer(current, asset);
      await deps.saveState(state);
      const thumbnail = await deps.makeThumbnail(asset);
      if (!enabled) return;
      pending = asset;
      deps.send({ type: 'screenshot-available', id: asset.id, thumbnail });
    } catch {
      // Photos can fail (iCloud, revoked access): the offer is optional, never an error for the user.
    } finally {
      busy = false;
    }
  }

  return {
    async enable(): Promise<void> {
      enabled = true;
      try {
        await ensureState();
        let access = await deps.getAccess();
        if (access === 'undetermined') access = await deps.requestAccess();
        deps.send({ type: 'screenshots-status', status: access });
        if (access === 'granted' || access === 'limited') await check();
      } catch {
        deps.send({ type: 'screenshots-status', status: 'denied' });
      }
    },
    disable(): void {
      enabled = false;
      pending = null;
    },
    /** App came to the foreground, or the in-app screenshot listener fired. */
    check,
    async accept(id: string): Promise<void> {
      if (!enabled || !pending || pending.id !== id) return;
      const asset = pending;
      pending = null;
      try {
        deps.send({ type: 'screenshot-data', id: asset.id, dataUrl: await deps.makeFullImage(asset) });
      } catch {
        // Could not read the image: the web keeps its prompt until the user dismisses it.
      }
    },
  };
}

export type ScreenshotController = ReturnType<typeof createScreenshotController>;
