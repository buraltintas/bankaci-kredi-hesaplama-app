import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import { initializeInterstitialAds, runActionWithOptionalInterstitial } from './interstitialService';
import type { InterstitialActionName } from './adConfig';

type OptionalAction = () => Promise<void> | void;

export const useInterstitialAction = () => {
  const [isInterstitialActionRunning, setIsInterstitialActionRunning] = useState(false);
  const isRunningRef = useRef(false);

  useEffect(() => {
    void initializeInterstitialAds();
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
