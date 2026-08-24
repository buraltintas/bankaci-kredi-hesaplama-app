import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { colors, radius, spacing, typography } from '../design/tokens';
import {
  getHasResolvedPremium,
  getIsPremium,
  subscribeToPremium,
} from './premiumStore';
import { initializePurchases, refreshPremiumStatus } from './purchases';

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

const PREMIUM_CHECK_OVERLAY_TIMEOUT_MS = 8000;

export const PremiumProvider = ({ children }: PropsWithChildren) => {
  const [snapshot, setSnapshot] = useState(readSnapshot);
  const [isCheckingPremium, setIsCheckingPremium] = useState(true);

  useEffect(() => {
    let isActive = true;
    let wasOffline = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

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
    const timeout = new Promise<void>((resolve) => {
      timeoutId = setTimeout(resolve, PREMIUM_CHECK_OVERLAY_TIMEOUT_MS);
    });

    void Promise.race([initializePurchases(), timeout]).finally(() => {
      if (isActive) {
        setIsCheckingPremium(false);
      }
    });

    const unsubscribeFromNetwork = NetInfo.addEventListener((state) => {
      const isOffline =
        state.isConnected === false || state.isInternetReachable === false;

      if (isOffline) {
        wasOffline = true;
        if (isActive) setIsCheckingPremium(false);
        return;
      }

      if (wasOffline) {
        wasOffline = false;
        void refreshPremiumStatus();
      }
    });

    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribeFromNetwork();
      unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      isPremium: snapshot.isPremium,
      hasResolvedPremium: snapshot.hasResolvedPremium,
    }),
    [snapshot.isPremium, snapshot.hasResolvedPremium]
  );

  return (
    <PremiumContext.Provider value={value}>
      {children}
      <Modal
        animationType="fade"
        statusBarTranslucent
        transparent
        visible={isCheckingPremium}
      >
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.overlayTitle}>Premium durumu kontrol ediliyor</Text>
            <Text style={styles.overlayText}>Lütfen kısa bir süre bekleyin.</Text>
          </View>
        </View>
      </Modal>
    </PremiumContext.Provider>
  );
};

export const usePremium = (): PremiumContextValue => useContext(PremiumContext);

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(20, 33, 61, 0.32)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  overlayCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    maxWidth: 360,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    width: '100%',
  },
  overlayTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  overlayText: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
