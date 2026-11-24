// The Expo half of the screenshot offer: Photos, image resizing and the persisted state, wired into the
// injected-dependency controller (screenshotController.ts). Not unit-tested: it needs a device.
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as SecureStore from 'expo-secure-store';
import { createScreenshotController, type ScreenshotController } from './screenshotController';
import { accessStatus, fitWithin, MAX_IMAGE_SIDE, OFFER_WINDOW_MS, parseState, serializeState, THUMB_SIDE, type AssetLike } from './screenshotOffer';
import type { ShellEvent } from './shellEvents';

const STATE_KEY = 'deck.screenshotOffer.v1';

async function jpegDataUrl(asset: AssetLike, side: number, quality: number): Promise<string> {
  // `ph://` URIs are not always readable by the manipulator: resolve the local file first.
  const info = await MediaLibrary.getAssetInfoAsync(asset.id);
  const uri = info.localUri ?? info.uri;
  const fit = fitWithin(info.width || asset.width, info.height || asset.height, side);
  const out = await ImageManipulator.manipulateAsync(uri, fit ? [{ resize: fit }] : [], { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new Error('no image data');
  return `data:image/jpeg;base64,${out.base64}`;
}

export function createNativeScreenshotController(send: (event: ShellEvent) => void): ScreenshotController {
  return createScreenshotController({
    now: () => Date.now(),
    getAccess: async () => accessStatus(await MediaLibrary.getPermissionsAsync(false)),
    requestAccess: async () => accessStatus(await MediaLibrary.requestPermissionsAsync(false)),
    latestScreenshot: async () => {
      const page = await MediaLibrary.getAssetsAsync({
        first: 1,
        mediaType: 'photo',
        mediaSubtypes: ['screenshot'],
        sortBy: 'creationTime',
        createdAfter: Date.now() - OFFER_WINDOW_MS,
      });
      return page.assets[0] ?? null;
    },
    makeThumbnail: (a) => jpegDataUrl(a, THUMB_SIDE, 0.5),
    makeFullImage: (a) => jpegDataUrl(a, MAX_IMAGE_SIDE, 0.8),
    loadState: async () => parseState(await SecureStore.getItemAsync(STATE_KEY)),
    saveState: (s) => SecureStore.setItemAsync(STATE_KEY, serializeState(s)),
    send,
  });
}
