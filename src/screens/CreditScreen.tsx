import React, { useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import LoanCalculator from '../../components/LoanCalculator';
import CreditModeTabs, { type CreditMode } from '../components/CreditModeTabs';
import { usePaywall } from '../subscription/PaywallProvider';
import { usePremium } from '../subscription/PremiumProvider';
import { canUseTransfer } from '../subscription/premiumFeatures';
import CommercialCalculatorScreen from './CommercialCalculatorScreen';
import TransferScreen from './TransferScreen';

const MODE_INDEX: Record<CreditMode, number> = {
  individual: 0,
  commercial: 1,
  transfer: 2,
};

export default function CreditScreen() {
  const { isPremium } = usePremium();
  const { openPaywall } = usePaywall();
  const [mode, setMode] = useState<CreditMode>('individual');
  const [mountedModes, setMountedModes] = useState<Record<CreditMode, boolean>>({
    individual: true,
    commercial: false,
    transfer: false,
  });
  const requestedMode = useRef<CreditMode>('individual');
  const tabProgress = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const transitionRef = useRef<Animated.CompositeAnimation | null>(null);

  const changeMode = (nextMode: CreditMode) => {
    if (nextMode === 'transfer' && !canUseTransfer(isPremium)) {
      openPaywall();
      return;
    }

    if (nextMode === requestedMode.current) return;

    requestedMode.current = nextMode;
    setMountedModes((current) =>
      current[nextMode] ? current : { ...current, [nextMode]: true }
    );
    transitionRef.current?.stop();
    const indicatorAnimation = Animated.parallel([
      Animated.timing(tabProgress, {
        toValue: MODE_INDEX[nextMode],
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: nextMode === mode ? 1 : 0,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    transitionRef.current = indicatorAnimation;
    indicatorAnimation.start(({ finished }) => {
      if (!finished || requestedMode.current !== nextMode || nextMode === mode) {
        return;
      }

      setMode(nextMode);

      const fadeAnimation = Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      transitionRef.current = fadeAnimation;
      fadeAnimation.start();
    });
  };

  const tabs = (
    <CreditModeTabs
      value={mode}
      onChange={changeMode}
      progress={tabProgress}
      showTransferPremiumBadge={!isPremium}
    />
  );

  return (
    <Animated.View style={styles.container}>
      <View
        accessibilityElementsHidden={mode !== 'individual'}
        importantForAccessibility={
          mode === 'individual' ? 'auto' : 'no-hide-descendants'
        }
        pointerEvents={mode === 'individual' ? 'auto' : 'none'}
        style={[styles.screen, mode !== 'individual' && styles.hiddenScreen]}
      >
        <LoanCalculator topContent={tabs} contentOpacity={contentOpacity} />
      </View>
      {mountedModes.commercial ? (
        <View
          accessibilityElementsHidden={mode !== 'commercial'}
          importantForAccessibility={
            mode === 'commercial' ? 'auto' : 'no-hide-descendants'
          }
          pointerEvents={mode === 'commercial' ? 'auto' : 'none'}
          style={[styles.screen, mode !== 'commercial' && styles.hiddenScreen]}
        >
          <CommercialCalculatorScreen
            topContent={tabs}
            contentOpacity={contentOpacity}
          />
        </View>
      ) : null}
      {mountedModes.transfer ? (
        <View
          accessibilityElementsHidden={mode !== 'transfer'}
          importantForAccessibility={
            mode === 'transfer' ? 'auto' : 'no-hide-descendants'
          }
          pointerEvents={mode === 'transfer' ? 'auto' : 'none'}
          style={[styles.screen, mode !== 'transfer' && styles.hiddenScreen]}
        >
          <TransferScreen topContent={tabs} contentOpacity={contentOpacity} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hiddenScreen: {
    opacity: 0,
    zIndex: 0,
  },
  screen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
});
