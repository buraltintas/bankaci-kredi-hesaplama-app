import { Platform, type PlatformOSType } from 'react-native';

export type InterstitialActionName = 'share' | 'pdf';

type SupportedAdPlatform = Extract<PlatformOSType, 'ios' | 'android'>;

export const INTERSTITIAL_SHOW_TIMEOUT_MS = 60 * 1000;
export const ADS_ENABLED = true;

export const ADMOB_APP_IDS: Record<SupportedAdPlatform, string> = {
  ios: 'ca-app-pub-7640689562014954~6678228604',
  android: 'ca-app-pub-7640689562014954~1997540159',
};

export const ADMOB_INTERSTITIAL_IDS: Record<SupportedAdPlatform, string> = {
  ios: 'ca-app-pub-7640689562014954/1958887414',
  android: 'ca-app-pub-7640689562014954/9816025277',
};

export const ADMOB_TEST_INTERSTITIAL_IDS: Record<SupportedAdPlatform, string> = {
  ios: 'ca-app-pub-3940256099942544/4411468910',
  android: 'ca-app-pub-3940256099942544/1033173712',
};

const isSupportedAdPlatform = (platform: PlatformOSType): platform is SupportedAdPlatform => {
  return platform === 'ios' || platform === 'android';
};

const isUsableAdUnitId = (adUnitId: string | undefined): adUnitId is string => {
  return Boolean(adUnitId?.startsWith('ca-app-pub-') && !adUnitId.includes('XXXXXXXXXXXXXXXX'));
};

export const isDevelopmentAdMode = (): boolean => {
  if (typeof __DEV__ !== 'undefined') {
    return __DEV__;
  }

  return process.env.NODE_ENV !== 'production';
};

export const getInterstitialAdUnitId = (): string => {
  if (!isSupportedAdPlatform(Platform.OS)) {
    return '';
  }

  const adUnitId = isDevelopmentAdMode()
    ? ADMOB_TEST_INTERSTITIAL_IDS[Platform.OS]
    : ADMOB_INTERSTITIAL_IDS[Platform.OS];

  return isUsableAdUnitId(adUnitId) ? adUnitId : '';
};

export const shouldRequestNonPersonalizedAds = (): boolean => false;
