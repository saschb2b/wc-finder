import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

/**
 * Light impact for subtle feedback (taps, selections)
 */
export function lightImpact() {
  if (isWeb) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * Medium impact for standard interactions (buttons, toggles)
 */
export function mediumImpact() {
  if (isWeb) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/**
 * Heavy impact for significant actions (deletions, confirmations)
 */
export function heavyImpact() {
  if (isWeb) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/**
 * Success notification for positive actions
 */
export function successNotification() {
  if (isWeb) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/**
 * Error notification for failures
 */
export function errorNotification() {
  if (isWeb) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

/**
 * Warning notification for cautions
 */
export function warningNotification() {
  if (isWeb) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}
