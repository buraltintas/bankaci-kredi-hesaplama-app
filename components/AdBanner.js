import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import { colors, radius, spacing } from '../src/design/tokens';
import { areAdsEnabled, getBannerAdUnitId } from '../src/ads/adConfig';
import { usePremium } from '../src/subscription/PremiumProvider';
import { usePaywall } from '../src/subscription/PaywallProvider';

const loadGoogleMobileAds = () => {
  if (Constants.appOwnership === 'expo') {
    return null;
  }

  try {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    return require('react-native-google-mobile-ads');
  } catch {
    return null;
  }
};

const ResultBannerAd = () => {
  // Both values come from context so this banner re-renders on either edge:
  // it disappears the instant a purchase completes, and it appears as soon as
  // a free user's entitlement is known to be absent.
  const { isPremium, hasResolvedPremium } = usePremium();
  const { openPaywall } = usePaywall();
  const adsDisabled = isPremium || !hasResolvedPremium || !areAdsEnabled();
  // Loading the module is itself gated: a subscriber never even pulls the
  // AdMob native module into memory, let alone requests an ad.
  const adsModule = useMemo(
    () => (adsDisabled ? null : loadGoogleMobileAds()),
    [adsDisabled]
  );
  const adUnitId = getBannerAdUnitId();

  if (adsDisabled || !adsModule || !adUnitId) {
    return null;
  }

  const { BannerAd, BannerAdSize } = adsModule;
  const bannerSize =
    BannerAdSize?.ANCHORED_ADAPTIVE_BANNER ?? BannerAdSize?.BANNER;

  if (!BannerAd || !bannerSize) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      {/* Placed above the ad with a deliberate gap: a tappable element flush
          against a banner invites accidental clicks, which AdMob counts as
          invalid traffic. */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Reklamları kaldır"
        style={styles.removeAdsButton}
        onPress={openPaywall}
      >
        <Text style={styles.removeAdsText}>Reklamları kaldır</Text>
      </TouchableOpacity>
      <View style={styles.container}>
        <BannerAd
          unitId={adUnitId}
          size={bannerSize}
          requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.sm,
  },
  removeAdsButton: {
    alignSelf: 'flex-end',
    justifyContent: 'center',
    // Wide gap on purpose: tested on device, a thumb aiming here was landing
    // on the banner instead. Accidental ad clicks count as invalid traffic.
    marginBottom: spacing.xl,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  removeAdsText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: spacing.xs,
  },
});

export default ResultBannerAd;
