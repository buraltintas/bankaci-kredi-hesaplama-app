import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getIsPremium,
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
  }
};

export const startPersistingPremium = (): (() => void) => {
  return subscribeToPremium((isPremium) => {
    const persistence = isPremium
      ? AsyncStorage.setItem(PREMIUM_CACHE_KEY, '1')
      : AsyncStorage.removeItem(PREMIUM_CACHE_KEY);

    void persistence.catch(() => undefined);
  });
};

export const __getCachedPremiumForTests = (): boolean => getIsPremium();
