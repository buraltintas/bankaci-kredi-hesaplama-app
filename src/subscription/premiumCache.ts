import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getIsPremium,
  markPremiumResolved,
  setIsPremium,
  subscribeToPremium,
} from './premiumStore';

const PREMIUM_CACHE_KEY = 'bankaci.premium.v1';

/**
 * Restores the last known entitlement so an offline subscriber stays ad-free
 * until RevenueCat answers. Only ever grants premium from cache — losing it
 * requires a real answer from the store.
 */
export const hydratePremiumFromCache = async (): Promise<void> => {
  try {
    const cached = await AsyncStorage.getItem(PREMIUM_CACHE_KEY);

    if (cached === '1') {
      setIsPremium(true);
    }
  } catch {
    // Cache unavailable — fall back to the network result.
  } finally {
    // The cached answer is enough to decide locally: ads stay blocked for a
    // known subscriber and are allowed for everyone else without waiting on
    // the network.
    markPremiumResolved();
  }
};

export const startPersistingPremium = (): (() => void) => {
  return subscribeToPremium((isPremium) => {
    void AsyncStorage.setItem(PREMIUM_CACHE_KEY, isPremium ? '1' : '0').catch(
      () => undefined
    );
  });
};

export const __getCachedPremiumForTests = (): boolean => getIsPremium();
