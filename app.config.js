const fs = require('fs');
const path = require('path');
const baseConfig = require('./app.json');

const readAdMobAppIds = () => {
  const adConfigPath = path.join(process.cwd(), 'src/ads/adConfig.ts');
  const adConfigSource = fs.readFileSync(adConfigPath, 'utf8');
  const appIdsBlock = adConfigSource.match(/export const ADMOB_APP_IDS[\s\S]*?= \{([\s\S]*?)\};/);
  const iosAppId = appIdsBlock?.[1]?.match(/ios:\s*'([^']+)'/)?.[1];
  const androidAppId = appIdsBlock?.[1]?.match(/android:\s*'([^']+)'/)?.[1];

  if (!iosAppId || !androidAppId) {
    throw new Error('AdMob App ID values are missing in src/ads/adConfig.ts');
  }

  return {
    ios: iosAppId,
    android: androidAppId,
  };
};

module.exports = ({ config: generatedConfig }) => {
  // iOS: New Arch disabled — react-native-google-mobile-ads v16 crashes on iOS with New Arch.
  // Android: New Arch enabled — codegen must run for NativeAppModuleSpec generation.
  // EAS_BUILD_PLATFORM is 'ios' | 'android' during EAS builds, undefined locally.
  const newArchEnabled = process.env.EAS_BUILD_PLATFORM !== 'ios';

  const config = {
    ...generatedConfig,
    ...baseConfig.expo,
    newArchEnabled,
    ios: {
      ...(generatedConfig.ios || {}),
      ...(baseConfig.expo.ios || {}),
    },
    android: {
      ...(generatedConfig.android || {}),
      ...(baseConfig.expo.android || {}),
    },
    web: {
      ...(generatedConfig.web || {}),
      ...(baseConfig.expo.web || {}),
    },
  };
  const admobAppIds = readAdMobAppIds();

  return {
    ...config,
    plugins: [
      ...(config.plugins || []),
      [
        'react-native-google-mobile-ads',
        {
          iosAppId: admobAppIds.ios,
          androidAppId: admobAppIds.android,
          delayAppMeasurementInit: true,
          userTrackingUsageDescription:
            'Bu tanımlayıcı, izin verirseniz reklamları kişiselleştirmek için kullanılabilir.',
        },
      ],
    ],
    extra: {
      ...(config.extra || {}),
      admob: {
        iosAppId: admobAppIds.ios,
        androidAppId: admobAppIds.android,
      },
    },
  };
};
