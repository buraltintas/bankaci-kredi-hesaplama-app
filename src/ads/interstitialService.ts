import MobileAds, { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';
import {
  ADS_ENABLED,
  INTERSTITIAL_SHOW_TIMEOUT_MS,
  getInterstitialAdUnitId,
  type InterstitialActionName,
} from './adConfig';

let currentAd: InterstitialAd | null = null;
let adLoaded = false;
let adLoading = false;
let actionInProgress = false;

const logInterstitialDebug = (message: string): void => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[Interstitial] ${message}`);
  }
};

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

  if (adLoading) {
    logInterstitialDebug('Ad preload skipped: already loading');
    return;
  }

  if (adLoaded && currentAd) {
    logInterstitialDebug('Ad preload skipped: already ready');
    return;
  }

  try {
    logInterstitialDebug('Ad preload requested');
    adLoaded = false;
    adLoading = true;
    currentAd = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: false,
    });
    const ad = currentAd;
    let unsubLoaded: (() => void) | undefined;
    let unsubError: (() => void) | undefined;
    const cleanupLoadListeners = () => {
      unsubLoaded?.();
      unsubError?.();
      unsubLoaded = undefined;
      unsubError = undefined;
    };

    unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      if (currentAd !== ad) return;
      adLoaded = true;
      adLoading = false;
      logInterstitialDebug('Ad loaded');
      cleanupLoadListeners();
    });

    unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
      if (currentAd !== ad) return;
      adLoaded = false;
      adLoading = false;
      currentAd = null;
      logInterstitialDebug('Ad failed to load');
      cleanupLoadListeners();
    });

    ad.load();
  } catch {
    adLoaded = false;
    adLoading = false;
    currentAd = null;
  }
};

export const runActionWithOptionalInterstitial = async (
  actionName: InterstitialActionName,
  callback: () => Promise<void> | void
): Promise<void> => {
  if (actionInProgress) return;
  actionInProgress = true;

  try {
    logInterstitialDebug(`${actionName === 'pdf' ? 'PDF' : 'Share'} pressed`);
    const canShowAd = ADS_ENABLED && adLoaded && currentAd !== null;

    if (canShowAd) {
      const ad = currentAd!;
      adLoaded = false;
      adLoading = false;
      currentAd = null;

      try {
        await new Promise<void>((resolve) => {
          let settled = false;
          let unsubClosed: (() => void) | undefined;
          let unsubError: (() => void) | undefined;

          const settle = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve();
          };

          const timer = setTimeout(settle, INTERSTITIAL_SHOW_TIMEOUT_MS);

          unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
            unsubClosed?.();
            unsubError?.();
            logInterstitialDebug('Ad dismissed');
            settle();
          });

          unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
            unsubClosed?.();
            unsubError?.();
            logInterstitialDebug('Ad show failed');
            settle();
          });

          try {
            logInterstitialDebug('Ad shown');
            void Promise.resolve(ad.show()).catch(() => {
              unsubClosed?.();
              unsubError?.();
              logInterstitialDebug('Ad show failed');
              settle();
            });
          } catch {
            unsubClosed?.();
            unsubError?.();
            logInterstitialDebug('Ad show failed');
            settle();
          }
        });
      } catch {
        // Ad promise rejected — fall through to callback
      }
    }

    await callback();
    logInterstitialDebug('PDF/share action continued');
  } finally {
    actionInProgress = false;
    preloadInterstitialAd();
  }
};

export const __resetInterstitialServiceForTests = (): void => {
  currentAd = null;
  adLoaded = false;
  adLoading = false;
  actionInProgress = false;
};
