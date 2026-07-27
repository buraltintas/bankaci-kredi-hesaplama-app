import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { colors, radius, spacing } from '../src/design/tokens';
import { ADS_ENABLED, getBannerAdUnitId } from '../src/ads/adConfig';

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
  const adsModule = useMemo(loadGoogleMobileAds, []);
  const adUnitId = getBannerAdUnitId();

  if (!ADS_ENABLED || !adsModule || !adUnitId) {
    return null;
  }

  const { BannerAd, BannerAdSize } = adsModule;
  const bannerSize =
    BannerAdSize?.ANCHORED_ADAPTIVE_BANNER ?? BannerAdSize?.BANNER;

  if (!BannerAd || !bannerSize) {
    return null;
  }

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={adUnitId}
        size={bannerSize}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    paddingVertical: spacing.xs,
  },
});

export default ResultBannerAd;
