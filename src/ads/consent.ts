type AdsConsentModule = {
  requestInfoUpdate: () => Promise<{ isConsentFormAvailable?: boolean; status?: string | number }>;
  loadAndShowConsentFormIfRequired?: () => Promise<unknown>;
};

type GoogleMobileAdsModule = {
  AdsConsent?: AdsConsentModule;
};

let consentRequestPromise: Promise<void> | null = null;

const canLogAdWarnings = (): boolean => process.env.NODE_ENV !== 'production';

const loadAdsConsent = (): AdsConsentModule | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const adsModule = require('react-native-google-mobile-ads') as GoogleMobileAdsModule;
    return adsModule.AdsConsent ?? null;
  } catch (error) {
    if (canLogAdWarnings()) {
      console.warn('[ads] Consent module unavailable; continuing without ads consent.', error);
    }
    return null;
  }
};

export const prepareAdsConsent = async (): Promise<void> => {
  if (consentRequestPromise) {
    return consentRequestPromise;
  }

  consentRequestPromise = (async () => {
    const adsConsent = loadAdsConsent();

    if (!adsConsent) {
      return;
    }

    try {
      await adsConsent.requestInfoUpdate();
      await adsConsent.loadAndShowConsentFormIfRequired?.();
    } catch (error) {
      if (canLogAdWarnings()) {
        console.warn('[ads] Consent flow failed; ads will remain optional.', error);
      }
    }
  })();

  return consentRequestPromise;
};
