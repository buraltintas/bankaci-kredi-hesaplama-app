type GlobalWithDev = typeof globalThis & { __DEV__?: boolean };

const originalDevDescriptor = Object.getOwnPropertyDescriptor(globalThis as GlobalWithDev, '__DEV__');

const loadAdConfig = (platform: string, isDev: boolean) => {
  jest.resetModules();
  jest.doMock('react-native', () => ({
    Platform: { OS: platform },
  }));
  Object.defineProperty(globalThis as GlobalWithDev, '__DEV__', {
    configurable: true,
    value: isDev,
  });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./adConfig') as typeof import('./adConfig');
};

afterEach(() => {
  jest.dontMock('react-native');
  jest.resetModules();

  if (originalDevDescriptor) {
    Object.defineProperty(globalThis as GlobalWithDev, '__DEV__', originalDevDescriptor);
  } else {
    delete (globalThis as GlobalWithDev).__DEV__;
  }
});

test('uses Google test interstitial ID in development on iOS', () => {
  const adConfig = loadAdConfig('ios', true);

  expect(adConfig.getInterstitialAdUnitId()).toBe('ca-app-pub-3940256099942544/4411468910');
});

test('uses Google test banner ID in development on Android', () => {
  const adConfig = loadAdConfig('android', true);

  expect(adConfig.getBannerAdUnitId()).toBe('ca-app-pub-3940256099942544/6300978111');
});

test('uses Google test banner ID in development on iOS', () => {
  const adConfig = loadAdConfig('ios', true);

  expect(adConfig.getBannerAdUnitId()).toBe('ca-app-pub-3940256099942544/2934735716');
});

test('uses real iOS interstitial ID in production', () => {
  const adConfig = loadAdConfig('ios', false);

  expect(adConfig.getInterstitialAdUnitId()).toBe('ca-app-pub-7640689562014954/1958887414');
});

test('uses real Android interstitial ID in production', () => {
  const adConfig = loadAdConfig('android', false);

  expect(adConfig.getInterstitialAdUnitId()).toBe('ca-app-pub-7640689562014954/9816025277');
});

test('uses real iOS banner ID in production', () => {
  const adConfig = loadAdConfig('ios', false);

  expect(adConfig.getBannerAdUnitId()).toBe('ca-app-pub-7640689562014954/4848977897');
});

test('uses real Android banner ID in production', () => {
  const adConfig = loadAdConfig('android', false);

  expect(adConfig.getBannerAdUnitId()).toBe('ca-app-pub-7640689562014954/9522454141');
});

test('returns empty ad unit ID on unsupported platforms', () => {
  const adConfig = loadAdConfig('web', false);

  expect(adConfig.getInterstitialAdUnitId()).toBe('');
  expect(adConfig.getBannerAdUnitId()).toBe('');
});
