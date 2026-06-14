import MobileAds, { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';
import {
  ADS_ENABLED,
  INTERSTITIAL_MIN_INTERVAL_MS,
  INTERSTITIAL_SHOW_TIMEOUT_MS,
  SKIP_FIRST_INTERSTITIAL_ACTION,
  getInterstitialAdUnitId,
  type InterstitialActionName,
} from './adConfig';

let currentAd: InterstitialAd | null = null;
let adLoaded = false;
let actionInProgress = false;
let actionCount = 0;
let lastShownAt = 0;

export const initializeInterstitialAds = async (): Promise<void> => {
  if (!ADS_ENABLED) return;
  try {
    await MobileAds().initialize();
  } catch {
    // SDK initialization failed — ads won't show but app continues normally
  }
  preloadInterstitialAd();
};

export const preloadInterstitialAd = (): void => {
  if (!ADS_ENABLED) return;

  const adUnitId = getInterstitialAdUnitId();
  if (!adUnitId) return;

  try {
    adLoaded = false;
    currentAd = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubLoaded = currentAd.addAdEventListener(AdEventType.LOADED, () => {
      adLoaded = true;
      unsubLoaded?.();
    });

    const unsubError = currentAd.addAdEventListener(AdEventType.ERROR, () => {
      adLoaded = false;
      unsubError?.();
    });

    currentAd.load();
  } catch {
    adLoaded = false;
    currentAd = null;
  }
};

export const runActionWithOptionalInterstitial = async (
  _actionName: InterstitialActionName,
  callback: () => Promise<void> | void
): Promise<void> => {
  if (actionInProgress) return;
  actionInProgress = true;

  try {
    actionCount += 1;

    const now = Date.now();
    const cooldownActive = now - lastShownAt < INTERSTITIAL_MIN_INTERVAL_MS;
    const isFirstAction = SKIP_FIRST_INTERSTITIAL_ACTION && actionCount === 1;
    const canShowAd =
      ADS_ENABLED && adLoaded && currentAd !== null && !cooldownActive && !isFirstAction;

    if (canShowAd) {
      const ad = currentAd!;
      adLoaded = false;
      currentAd = null;

      try {
        await new Promise<void>((resolve) => {
          let settled = false;

          const settle = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve();
          };

          const timer = setTimeout(settle, INTERSTITIAL_SHOW_TIMEOUT_MS);

          const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
            unsubClosed?.();
            lastShownAt = Date.now();
            settle();
            setTimeout(() => preloadInterstitialAd(), 0);
          });

          const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
            unsubError?.();
            settle();
          });

          try {
            ad.show();
          } catch {
            unsubClosed?.();
            unsubError?.();
            settle();
          }
        });
      } catch {
        // Ad promise rejected — fall through to callback
      }
    }

    await callback();
  } finally {
    actionInProgress = false;
  }
};

export const __resetInterstitialServiceForTests = (): void => {
  currentAd = null;
  adLoaded = false;
  actionInProgress = false;
  actionCount = 0;
  lastShownAt = 0;
};
