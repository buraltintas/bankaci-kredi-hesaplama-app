import {
  parseForceUpdateConfig,
  requiresAndroidForceUpdate,
} from '../forceUpdateConfig';

const validConfig = {
  android: {
    enabled: true,
    minimumVersionCode: 18,
    latestVersionCode: 18,
    storeUrl:
      'https://play.google.com/store/apps/details?id=com.xewor.bankacikredihesaplama',
    message: "Bankacı'yı kullanmaya devam etmek için güncelleyin.",
  },
};

describe('force update config', () => {
  it('requires builds below the configured Android minimum', () => {
    const config = parseForceUpdateConfig(validConfig);

    expect(config).not.toBeNull();
    expect(requiresAndroidForceUpdate(17, config!.android)).toBe(true);
    expect(requiresAndroidForceUpdate(18, config!.android)).toBe(false);
    expect(requiresAndroidForceUpdate(19, config!.android)).toBe(false);
  });

  it('honors the emergency disable switch', () => {
    const config = parseForceUpdateConfig({
      android: { ...validConfig.android, enabled: false },
    });

    expect(requiresAndroidForceUpdate(17, config!.android)).toBe(false);
  });

  it('rejects malformed or contradictory policies', () => {
    expect(parseForceUpdateConfig(null)).toBeNull();
    expect(
      parseForceUpdateConfig({
        android: {
          ...validConfig.android,
          minimumVersionCode: 19,
          latestVersionCode: 18,
        },
      })
    ).toBeNull();
    expect(
      parseForceUpdateConfig({
        android: { ...validConfig.android, storeUrl: 'market://details' },
      })
    ).toBeNull();
  });
});
