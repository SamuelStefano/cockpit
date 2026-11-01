// The impure half of the bridge: runs a parsed message (src/bridge.ts) on the device.
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Share } from 'react-native';
import type { BridgeMessage, HapticStyle } from './bridge';

const IMPACT: Record<string, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
  rigid: Haptics.ImpactFeedbackStyle.Rigid,
  soft: Haptics.ImpactFeedbackStyle.Soft,
};
const NOTICE: Record<string, Haptics.NotificationFeedbackType> = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
};

async function haptic(style: HapticStyle): Promise<void> {
  if (style === 'selection') return Haptics.selectionAsync();
  if (style in NOTICE) return Haptics.notificationAsync(NOTICE[style]);
  return Haptics.impactAsync(IMPACT[style]);
}

/** Show a banner while the app is in the foreground too (the web asks at the end of a turn). */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

const MIN_NOTIFY_GAP_MS = 1000;
let lastNotifyAt = 0;

async function notify(title: string, body: string): Promise<void> {
  const now = Date.now();
  if (now - lastNotifyAt < MIN_NOTIFY_GAP_MS) return;
  lastNotifyAt = now;
  let { status } = await Notifications.getPermissionsAsync();
  // The system prompt appears the first time the web asks; a "no" is final and silent.
  if (status === 'undetermined') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return;
  await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
}

export async function runBridgeMessage(message: BridgeMessage): Promise<void> {
  try {
    switch (message.type) {
      case 'notify':
        return await notify(message.title, message.body);
      case 'share':
        await Share.share({ message: message.message, url: message.url });
        return;
      case 'haptic':
        return await haptic(message.style);
    }
  } catch {
    // A failed haptic, share or notification must never take the app down.
  }
}
