import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  getHasResolvedPremium,
  getIsPremium,
  subscribeToPremium,
} from './premiumStore';
import { initializePurchases } from './purchases';

type PremiumContextValue = {
  isPremium: boolean;
  /**
   * False only during the brief window before the entitlement is known. Ads
   * stay hidden until it flips, so consumers must re-render when it does —
   * otherwise a free user whose surface mounted early would never see an ad.
   */
  hasResolvedPremium: boolean;
};

const readSnapshot = (): PremiumContextValue => ({
  isPremium: getIsPremium(),
  hasResolvedPremium: getHasResolvedPremium(),
});

const PremiumContext = createContext<PremiumContextValue>({
  isPremium: false,
  hasResolvedPremium: false,
});

export const PremiumProvider = ({ children }: PropsWithChildren) => {
  const [snapshot, setSnapshot] = useState(readSnapshot);

  useEffect(() => {
    const sync = () => {
      const next = readSnapshot();

      setSnapshot((previous) =>
        previous.isPremium === next.isPremium &&
        previous.hasResolvedPremium === next.hasResolvedPremium
          ? previous
          : next
      );
    };

    const unsubscribe = subscribeToPremium(sync);
    // Covers the case where entitlement resolved between the initial render
    // and this subscription.
    sync();
    void initializePurchases();

    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      isPremium: snapshot.isPremium,
      hasResolvedPremium: snapshot.hasResolvedPremium,
    }),
    [snapshot.isPremium, snapshot.hasResolvedPremium]
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
};

export const usePremium = (): PremiumContextValue => useContext(PremiumContext);
