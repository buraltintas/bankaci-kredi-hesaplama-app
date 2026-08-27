import Constants from 'expo-constants';
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
import { getRevenueCatApiKey, PREMIUM_ENTITLEMENT_ID } from './subscriptionConfig';
import { getIsPremium, setIsPremium } from './premiumStore';
import { hydratePremiumFromCache, startPersistingPremium } from './premiumCache';

type PurchasesModule = typeof import('react-native-purchases').default;

let purchasesModule: PurchasesModule | null | undefined;
let configured = false;
let initializationPromise: Promise<void> | null = null;
let persistenceStarted = false;

const loadPurchases = (): PurchasesModule | null => {
  if (Constants.appOwnership === 'expo') {
    return null;
  }

  if (purchasesModule !== undefined) {
    return purchasesModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    purchasesModule = require('react-native-purchases').default as PurchasesModule;
  } catch {
    purchasesModule = null;
  }

  return purchasesModule;
};

const hasPremiumEntitlement = (customerInfo: CustomerInfo): boolean => {
  return customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
};

/** Refreshes the entitlement after connectivity returns or a support grant. */
export const refreshPremiumStatus = async (
  invalidateCache = false
): Promise<boolean | null> => {
  const Purchases = loadPurchases();

  if (!Purchases) {
    return null;
  }

  try {
    if (invalidateCache) {
      await Purchases.invalidateCustomerInfoCache();
    }
    const customerInfo = await Purchases.getCustomerInfo();
    const isPremium = hasPremiumEntitlement(customerInfo);
    setIsPremium(isPremium);
    return isPremium;
  } catch {
    // Keep the cached/unknown state. Unknown users remain ad-free.
    return null;
  }
};

let anonymousRestoreAttempted = false;

/**
 * A fresh install has a new anonymous RevenueCat identity, so a subscription
 * bought earlier (and never linked to an account) is not yet visible. Syncing
 * the store transactions posts the receipt and restores the entitlement
 * silently — no login and no App Store password prompt, unlike restore.
 *
 * Skipped once premium is already known, and for identified (logged-in) users,
 * whose entitlement comes from their account rather than this device.
 */
const restoreAnonymousEntitlementOnce = async (
  Purchases: PurchasesModule
): Promise<void> => {
  if (anonymousRestoreAttempted || getIsPremium()) {
    return;
  }
  anonymousRestoreAttempted = true;
  try {
    if (!(await Purchases.isAnonymous())) {
      return;
    }
    const { customerInfo } = await Purchases.syncPurchasesForResult();
    setIsPremium(hasPremiumEntitlement(customerInfo));
  } catch {
    // The manual "Satın alımları geri yükle" control remains as a fallback.
  }
};

/**
 * Configures RevenueCat and starts tracking the premium entitlement.
 * Safe to call more than once; only the first call configures the SDK.
 */
export const initializePurchases = async (
  appUserId?: string
): Promise<void> => {
  if (!persistenceStarted) {
    startPersistingPremium();
    persistenceStarted = true;
  }
  await hydratePremiumFromCache();

  const Purchases = loadPurchases();
  const apiKey = getRevenueCatApiKey();

  if (!Purchases || !apiKey || configured) {
    return;
  }

  if (!initializationPromise) {
    initializationPromise = (async () => {
      try {
        Purchases.configure({ apiKey, appUserID: appUserId });
        configured = true;

        Purchases.addCustomerInfoUpdateListener((customerInfo) => {
          setIsPremium(hasPremiumEntitlement(customerInfo));
        });

        await refreshPremiumStatus();
        await restoreAnonymousEntitlementOnce(Purchases);
      } catch {
        // Offline or misconfigured — the cached entitlement stays in effect.
      }
    })().finally(() => {
      initializationPromise = null;
    });
  }

  await initializationPromise;
};

export const getPremiumOffering = async (): Promise<PurchasesOffering | null> => {
  const Purchases = loadPurchases();

  if (!Purchases) {
    return null;
  }

  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch {
    return null;
  }
};

/**
 * Anonymous RevenueCat identifier used to locate the customer during support.
 * Null in Expo Go or when the native SDK is unavailable.
 */
export const getRevenueCatAppUserId = async (): Promise<string | null> => {
  const Purchases = loadPurchases();

  if (!Purchases) {
    return null;
  }

  try {
    return await Purchases.getAppUserID();
  } catch {
    return null;
  }
};

/**
 * Connects a verified Bankacı account to RevenueCat. Existing anonymous
 * purchases are preserved: if login ever drops an entitlement because the
 * target identity already existed, syncing the store receipt moves it to the
 * verified account under RevenueCat's transfer policy.
 */
export const identifyRevenueCatUser = async (
  appUserId: string,
  email?: string
): Promise<boolean> => {
  await initializePurchases(appUserId);
  const Purchases = loadPurchases();

  if (!Purchases || !appUserId) return false;

  try {
    const currentAppUserId = await Purchases.getAppUserID();
    const currentIdentityIsAnonymous = await Purchases.isAnonymous();
    const before = await Purchases.getCustomerInfo();
    const hadPremium = hasPremiumEntitlement(before);
    const customerInfo =
      currentAppUserId === appUserId
        ? before
        : (await Purchases.logIn(appUserId)).customerInfo;
    let resolvedInfo = customerInfo;

    // A purchase made before Bankacı login belongs to the device's anonymous
    // RevenueCat customer. Syncing the store receipt after login transfers it
    // to the verified account under the project's restore behavior. Never do
    // this while switching between two identified accounts; that could move
    // one banker's purchase to another banker.
    if (
      currentIdentityIsAnonymous &&
      hadPremium &&
      !hasPremiumEntitlement(customerInfo)
    ) {
      resolvedInfo = (await Purchases.syncPurchasesForResult()).customerInfo;
    }

    const isPremium = hasPremiumEntitlement(resolvedInfo);
    setIsPremium(isPremium);

    const normalizedEmail = email?.trim().toLowerCase();
    if (normalizedEmail) {
      try {
        // Keep the opaque rc_... value as the entitlement identity while also
        // making the verified account discoverable by email in RevenueCat.
        await Purchases.setEmail(normalizedEmail);
      } catch {
        // Subscriber attributes are support metadata. A temporary RevenueCat
        // failure must never invalidate login or the resolved entitlement.
      }
    }

    return isPremium;
  } catch {
    // The cached entitlement remains in force while offline. AuthProvider
    // retries identification on the next launch.
    return getIsPremiumAfterFailure();
  }
};

/** Returns to guest mode without touching the App Store / Play purchase. */
export const resetRevenueCatToGuest = async (): Promise<void> => {
  const Purchases = loadPurchases();
  if (!Purchases) return;

  try {
    if (!(await Purchases.isAnonymous())) {
      const customerInfo = await Purchases.logOut();
      setIsPremium(hasPremiumEntitlement(customerInfo));
      // logOut lands on a fresh anonymous identity. If this device's store
      // account still owns the subscription, restore it so signing out never
      // strips premium the person still paid for.
      anonymousRestoreAttempted = false;
      await restoreAnonymousEntitlementOnce(Purchases);
    }
  } catch {
    // Logout from the Bankacı API still succeeds; RevenueCat will be
    // reconciled on the next successful SDK call. Never retain the previous
    // account's entitlement for the next guest/account on this device.
    setIsPremium(false);
  }
};

const getIsPremiumAfterFailure = (): boolean => {
  // The store is intentionally the only entitlement authority in the app;
  // returning false here is only an operation result and does not mutate it.
  return false;
};

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'failed';

export const purchasePremiumPackage = async (
  packageToPurchase: PurchasesPackage
): Promise<PurchaseOutcome> => {
  const Purchases = loadPurchases();

  if (!Purchases) {
    return 'failed';
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    const isPremium = hasPremiumEntitlement(customerInfo);
    setIsPremium(isPremium);

    return isPremium ? 'purchased' : 'failed';
  } catch (error) {
    if ((error as { userCancelled?: boolean })?.userCancelled) {
      return 'cancelled';
    }

    return 'failed';
  }
};

export const restorePremiumPurchases = async (): Promise<boolean> => {
  const Purchases = loadPurchases();

  if (!Purchases) {
    return false;
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    const isPremium = hasPremiumEntitlement(customerInfo);
    setIsPremium(isPremium);

    return isPremium;
  } catch {
    return false;
  }
};

/**
 * Store-hosted subscription management page, so people can cancel where they
 * actually subscribed. Null when there is nothing to manage.
 */
export const getSubscriptionManagementUrl = async (): Promise<string | null> => {
  const Purchases = loadPurchases();

  if (!Purchases) {
    return null;
  }

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.managementURL ?? null;
  } catch {
    return null;
  }
};

export const __resetPurchasesForTests = (): void => {
  purchasesModule = undefined;
  configured = false;
  initializationPromise = null;
  persistenceStarted = false;
  anonymousRestoreAttempted = false;
};
