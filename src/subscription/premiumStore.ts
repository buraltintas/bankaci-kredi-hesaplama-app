type PremiumListener = (isPremium: boolean) => void;

let isPremium = false;
let hasResolvedOnce = false;
const listeners = new Set<PremiumListener>();

const notify = (): void => {
  listeners.forEach((listener) => listener(isPremium));
};

/**
 * Synchronous read for non-React callers — the ad services run outside the
 * component tree and must be able to check entitlement before every request.
 *
 * Deliberately free of storage and SDK imports: the ad layer depends on this
 * module, and pulling native modules in through it would drag them into every
 * consumer.
 */
export const getIsPremium = (): boolean => isPremium;

/**
 * True once entitlement state has been decided at least once, from cache or
 * from RevenueCat. Ads stay off until then, so a subscriber never sees an
 * impression during the unknown window on cold start.
 */
export const getHasResolvedPremium = (): boolean => hasResolvedOnce;

export const markPremiumResolved = (): void => {
  if (hasResolvedOnce) {
    return;
  }

  hasResolvedOnce = true;
  notify();
};

export const setIsPremium = (nextValue: boolean): void => {
  hasResolvedOnce = true;

  if (isPremium === nextValue) {
    return;
  }

  isPremium = nextValue;
  notify();
};

export const subscribeToPremium = (listener: PremiumListener): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const __resetPremiumStoreForTests = (): void => {
  isPremium = false;
  hasResolvedOnce = false;
  listeners.clear();
};
