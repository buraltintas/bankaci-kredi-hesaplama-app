import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import {
  discardPreloadedInterstitial,
  initializeInterstitialAds,
  runActionWithOptionalInterstitial,
} from './interstitialService';
import { areAdsEnabled, type InterstitialActionName } from './adConfig';
import { getIsPremium, subscribeToPremium } from '../subscription/premiumStore';

type OptionalAction = () => Promise<void> | void;

export const useInterstitialAction = () => {
  const [isInterstitialActionRunning, setIsInterstitialActionRunning] = useState(false);
  const isRunningRef = useRef(false);

  useEffect(() => {
    const syncWithEntitlement = () => {
      if (getIsPremium()) {
        // A purchase may have completed while an ad sat preloaded.
        discardPreloadedInterstitial();
        return;
      }

      if (areAdsEnabled()) {
        void initializeInterstitialAds();
      }
    };

    syncWithEntitlement();

    return subscribeToPremium(syncWithEntitlement);
  }, []);

  const runInterstitialAction = useCallback(
    async (actionName: InterstitialActionName, callback: OptionalAction) => {
      if (isRunningRef.current) return;

      isRunningRef.current = true;
      setIsInterstitialActionRunning(true);

      // Wait until React Native has committed the disabled state to native views
      // before starting the action (setTimeout(0) is insufficient on RN).
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(resolve);
      });

      try {
        await runActionWithOptionalInterstitial(actionName, callback);
      } finally {
        isRunningRef.current = false;
        setIsInterstitialActionRunning(false);
      }
    },
    [] // stable reference — guard is in ref, no stale-closure risk
  );

  return {
    isInterstitialActionRunning,
    runActionWithOptionalInterstitial: runInterstitialAction,
  };
};
