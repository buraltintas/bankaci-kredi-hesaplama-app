import AsyncStorage from '@react-native-async-storage/async-storage';
import { areAdsEnabled } from '../../ads/adConfig';
import {
  __resetPremiumStoreForTests,
  setIsPremium,
  subscribeToPremium,
} from '../premiumStore';
import { hydratePremiumFromCache, startPersistingPremium } from '../premiumCache';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();

  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        store.delete(key);
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store.clear();
        return Promise.resolve();
      }),
    },
  };
});

describe('ad gating by premium entitlement', () => {
  beforeEach(async () => {
    __resetPremiumStoreForTests();
    await AsyncStorage.clear();
    startPersistingPremium();
  });

  it('blocks ads while entitlement state is still unknown', () => {
    expect(areAdsEnabled()).toBe(false);
  });

  it('allows ads once a non-premium state is resolved', async () => {
    await hydratePremiumFromCache();
    setIsPremium(false);

    expect(areAdsEnabled()).toBe(true);
  });

  it('keeps ads blocked when an empty cache cannot resolve entitlement', async () => {
    await hydratePremiumFromCache();

    expect(areAdsEnabled()).toBe(false);
  });

  it('blocks ads for a premium user', async () => {
    await hydratePremiumFromCache();
    setIsPremium(true);

    expect(areAdsEnabled()).toBe(false);
  });

  it('brings ads back when the entitlement lapses', async () => {
    setIsPremium(true);
    setIsPremium(false);

    expect(areAdsEnabled()).toBe(true);
  });

  it('notifies subscribers when a free user resolves, so ad surfaces re-render', async () => {
    const listener = jest.fn();
    subscribeToPremium(listener);

    setIsPremium(false);

    // Without this notification a banner mounted during the unknown window
    // would stay hidden for the rest of the session — lost ad revenue.
    expect(listener).toHaveBeenCalled();
    expect(areAdsEnabled()).toBe(true);
  });

  it('keeps a returning subscriber ad-free before the network answers', async () => {
    setIsPremium(true);
    await Promise.resolve();

    __resetPremiumStoreForTests();
    expect(areAdsEnabled()).toBe(false);

    await hydratePremiumFromCache();
    expect(areAdsEnabled()).toBe(false);
  });
});
