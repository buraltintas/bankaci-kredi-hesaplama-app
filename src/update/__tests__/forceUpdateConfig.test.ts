import {
  parseForceUpdateConfig,
  requiresAndroidForceUpdate,
  requiresIosForceUpdate,
} from '../forceUpdateConfig';

const validAndroidPolicy = {
  enabled: true,
  minimumVersionCode: 20,
  latestVersionCode: 20,
  storeUrl:
    'https://play.google.com/store/apps/details?id=com.xewor.bankacikredihesaplama',
  message: "Bankacı'yı kullanmaya devam etmek için güncelleyin.",
};

const validIosPolicy = {
  enabled: true,
  minimumBuildNumber: 16,
  latestBuildNumber: 16,
  minimumShortVersion: '3.1.0',
  latestShortVersion: '3.1.0',
  storeUrl: 'https://apps.apple.com/app/id123',
  message: "Bankacı'yı kullanmaya devam etmek için güncelleyin.",
};

describe('force update config', () => {
  it('requires Android builds below the configured minimum', () => {
    const config = parseForceUpdateConfig({
      android: validAndroidPolicy,
    });

    expect(config?.android).not.toBeNull();
    expect(requiresAndroidForceUpdate(19, config!.android!)).toBe(true);
    expect(requiresAndroidForceUpdate(20, config!.android!)).toBe(false);
    expect(requiresAndroidForceUpdate(21, config!.android!)).toBe(false);
  });

  it('requires iOS builds below the configured minimum', () => {
    const config = parseForceUpdateConfig({ ios: validIosPolicy });

    expect(config?.ios).not.toBeNull();
    expect(requiresIosForceUpdate(15, config!.ios!)).toBe(true);
    expect(requiresIosForceUpdate(16, config!.ios!)).toBe(false);
    expect(requiresIosForceUpdate(17, config!.ios!)).toBe(false);
  });

  it('accepts a backend response with both platforms', () => {
    const config = parseForceUpdateConfig({
      android: validAndroidPolicy,
      ios: validIosPolicy,
      updatedAt: '2026-08-25T10:00:00Z',
    });

    expect(config?.android?.latestVersionCode).toBe(20);
    expect(config?.ios?.latestBuildNumber).toBe(16);
  });

  it('honors each platform emergency disable switch', () => {
    const config = parseForceUpdateConfig({
      android: { ...validAndroidPolicy, enabled: false },
      ios: { ...validIosPolicy, enabled: false },
    });

    expect(requiresAndroidForceUpdate(19, config!.android!)).toBe(false);
    expect(requiresIosForceUpdate(15, config!.ios!)).toBe(false);
  });

  it('rejects malformed policies without discarding a valid platform', () => {
    const config = parseForceUpdateConfig({
      android: {
        ...validAndroidPolicy,
        minimumVersionCode: 21,
        latestVersionCode: 20,
      },
      ios: validIosPolicy,
    });

    expect(config?.android).toBeNull();
    expect(config?.ios).not.toBeNull();
    expect(parseForceUpdateConfig(null)).toBeNull();
  });
});
