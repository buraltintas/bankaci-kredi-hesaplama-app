import { Platform, type PlatformOSType } from 'react-native';

type SupportedPurchasePlatform = Extract<PlatformOSType, 'ios' | 'android'>;

/**
 * RevenueCat public SDK keys. These are safe to ship in the client bundle —
 * they only allow the operations the SDK performs on the user's behalf.
 * The secret credentials (App Store .p8 keys, Play service account JSON)
 * live in the RevenueCat dashboard and never reach the app.
 */
export const REVENUECAT_API_KEYS: Record<SupportedPurchasePlatform, string> = {
  ios: 'appl_lAQSThlXUpNsKRUNLIjGLquPKRv',
  android: 'goog_oFZvmiIrXMqVcLjnHUUklKLMWpI',
};

/** Entitlement identifier configured in RevenueCat. */
export const PREMIUM_ENTITLEMENT_ID = 'premium';

export const isSupportedPurchasePlatform = (
  platform: PlatformOSType
): platform is SupportedPurchasePlatform => {
  return platform === 'ios' || platform === 'android';
};

export const getRevenueCatApiKey = (): string => {
  if (!isSupportedPurchasePlatform(Platform.OS)) {
    return '';
  }

  return REVENUECAT_API_KEYS[Platform.OS];
};
