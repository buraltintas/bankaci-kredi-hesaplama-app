import React, {
  createContext,
  useContext,
  useEffect,
  type PropsWithChildren,
} from 'react';
import NetInfo from '@react-native-community/netinfo';
import { flushCalculationAnalytics } from './analyticsStorage';

type AnalyticsContextValue = {
  enabled: boolean;
  isLoading: boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
};

const AnalyticsContext = createContext<AnalyticsContextValue>({
  enabled: true,
  isLoading: false,
  setEnabled: async () => undefined,
});

export const AnalyticsProvider = ({ children }: PropsWithChildren) => {
  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        if (state.isConnected && state.isInternetReachable !== false) {
          void flushCalculationAnalytics();
        }
      }),
    []
  );

  return (
    <AnalyticsContext.Provider
      value={{ enabled: true, isLoading: false, setEnabled: async () => undefined }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
};

export const useCalculationAnalytics = () => useContext(AnalyticsContext);
