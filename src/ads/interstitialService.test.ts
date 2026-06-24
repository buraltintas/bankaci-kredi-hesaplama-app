import type { InterstitialActionName } from './adConfig';

const mockListeners: Record<string, ((payload?: unknown) => void)[]> = {};
let mockAdLoaded = false;
let mockShow = jest.fn<Promise<void>, []>(() => {
  mockCreatedAd?.emit('closed');
  return Promise.resolve();
});
let mockCreatedAd: { emit: (event: string, payload?: unknown) => void } | null = null;
const mockCreatedAds: { load: jest.Mock<void, []>; emit: (event: string, payload?: unknown) => void }[] = [];
let mockIsConnected = true;
let mockIsInternetReachable: boolean | null = true;
let mockAppOwnership: string | null = null;

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(() =>
      Promise.resolve({
        isConnected: mockIsConnected,
        isInternetReachable: mockIsInternetReachable,
      })
    ),
  },
}));


jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get appOwnership() {
      return mockAppOwnership;
    },
  },
}));

jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: () => ({ initialize: jest.fn(() => Promise.resolve()) }),
  AdEventType: {
    CLOSED: 'closed',
    ERROR: 'error',
    LOADED: 'loaded',
  },
  AdsConsent: {
    loadAndShowConsentFormIfRequired: jest.fn(() => Promise.resolve()),
    requestInfoUpdate: jest.fn(() => Promise.resolve({ isConsentFormAvailable: false })),
  },
  InterstitialAd: {
    createForAdRequest: jest.fn(() => {
      const load = jest.fn();
      const ad = {
        get loaded() {
          return mockAdLoaded;
        },
        addAdEventListener: jest.fn((event: string, callback: (payload?: unknown) => void) => {
          mockListeners[event] = mockListeners[event] || [];
          mockListeners[event].push(callback);
          return () => {
            mockListeners[event] = mockListeners[event]?.filter(
              (listener) => listener !== callback
            ) ?? [];
          };
        }),
        load,
        show: mockShow,
      };
      mockCreatedAd = {
        emit: (event: string, payload?: unknown) => {
          mockListeners[event]?.forEach((callback) => callback(payload));
        },
      };
      mockCreatedAds.push({ load, emit: mockCreatedAd.emit });
      return ad;
    }),
  },
}));

const loadService = (adsEnabled = true) => {
  jest.doMock('./adConfig', () => ({
    ...jest.requireActual('./adConfig'),
    ADS_ENABLED: adsEnabled,
  }));
  jest.isolateModules(() => undefined);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./interstitialService') as typeof import('./interstitialService');
};

const run = async (
  service: typeof import('./interstitialService'),
  actionName: InterstitialActionName,
  callback: jest.Mock<Promise<void>, []> | jest.Mock<void, []>
) => service.runActionWithOptionalInterstitial(actionName, callback);

const waitUntil = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

beforeEach(() => {
  jest.resetModules();
  Object.keys(mockListeners).forEach((key) => {
    delete mockListeners[key];
  });
  mockCreatedAd = null;
  mockCreatedAds.length = 0;
  mockAdLoaded = false;
  mockIsConnected = true;
  mockIsInternetReachable = true;
  mockAppOwnership = null;
  mockShow = jest.fn<Promise<void>, []>(() => {
    mockCreatedAd?.emit('closed');
    return Promise.resolve();
  });
  jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('runs action directly when ads are disabled', async () => {
  const service = loadService(false);
  const callback = jest.fn(() => Promise.resolve());

  await run(service, 'share', callback);

  expect(callback).toHaveBeenCalledTimes(1);
  expect(mockShow).not.toHaveBeenCalled();
});

test('runs action directly in Expo Go when native ads module is unavailable', async () => {
  mockAppOwnership = 'expo';
  const service = loadService();
  const callback = jest.fn(() => Promise.resolve());

  await run(service, 'share', callback);

  expect(callback).toHaveBeenCalledTimes(1);
  expect(mockShow).not.toHaveBeenCalled();
});

test('runs action directly when offline', async () => {
  mockIsConnected = false;
  const service = loadService();
  const callback = jest.fn(() => Promise.resolve());

  await run(service, 'share', callback);

  expect(callback).toHaveBeenCalledTimes(1);
  expect(mockShow).not.toHaveBeenCalled();
});

test('preloads a single interstitial and skips duplicate requests while loading', async () => {
  const service = loadService();

  await service.initializeInterstitialAds();
  service.preloadInterstitialAd();
  service.preloadInterstitialAd();

  expect(mockCreatedAds).toHaveLength(1);
  expect(mockCreatedAds[0].load).toHaveBeenCalledTimes(1);
});

test('skips duplicate preload requests while an ad is already ready', async () => {
  const service = loadService();

  await service.initializeInterstitialAds();
  mockCreatedAd?.emit('loaded');
  mockAdLoaded = true;
  service.preloadInterstitialAd();
  service.preloadInterstitialAd();

  expect(mockCreatedAds).toHaveLength(1);
  expect(mockCreatedAds[0].load).toHaveBeenCalledTimes(1);
});

test('runs action directly when no interstitial is ready and keeps preload in flight', async () => {
  const service = loadService();
  const callback = jest.fn(() => Promise.resolve());

  await run(service, 'share', callback);

  expect(callback).toHaveBeenCalledTimes(1);
  expect(mockShow).not.toHaveBeenCalled();
  expect(mockCreatedAds).toHaveLength(1);
  expect(mockCreatedAds[0].load).toHaveBeenCalledTimes(1);
});

test('shows loaded interstitial then runs callback and preloads the next ad', async () => {
  const service = loadService();
  const callback = jest.fn(() => Promise.resolve());

  await service.initializeInterstitialAds();
  mockCreatedAd?.emit('loaded');
  mockAdLoaded = true;

  await run(service, 'pdf', callback);

  expect(mockShow).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledTimes(1);
  expect(mockCreatedAds).toHaveLength(2);
  expect(mockCreatedAds[1].load).toHaveBeenCalledTimes(1);
});

test('shows every ready interstitial action without issuing extra loads', async () => {
  const service = loadService();
  const callback = jest.fn(() => Promise.resolve());

  await service.initializeInterstitialAds();
  mockCreatedAd?.emit('loaded');
  mockAdLoaded = true;

  await run(service, 'share', callback);
  expect(mockCreatedAds).toHaveLength(2);

  mockCreatedAd?.emit('loaded');
  mockAdLoaded = true;
  await run(service, 'pdf', callback);

  expect(mockShow).toHaveBeenCalledTimes(2);
  expect(callback).toHaveBeenCalledTimes(2);
  expect(mockCreatedAds).toHaveLength(3);
});

test('show failure does not block action and preloads another interstitial', async () => {
  mockShow = jest.fn<Promise<void>, []>(() => Promise.reject(new Error('show failed')));
  const service = loadService();
  const callback = jest.fn(() => Promise.resolve());

  await service.initializeInterstitialAds();
  mockCreatedAd?.emit('loaded');
  mockAdLoaded = true;

  await run(service, 'pdf', callback);

  expect(mockShow).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledTimes(1);
  expect(mockCreatedAds).toHaveLength(2);
});

test('action lock prevents duplicate rapid actions', async () => {
  const service = loadService();
  let resolveFirst: () => void = () => undefined;
  const firstCallback = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveFirst = resolve;
      })
  );
  const secondCallback = jest.fn(() => Promise.resolve());

  const firstRun = run(service, 'share', firstCallback);
  await waitUntil(() => firstCallback.mock.calls.length === 1);
  await run(service, 'pdf', secondCallback);
  resolveFirst();
  await firstRun;

  expect(firstCallback).toHaveBeenCalledTimes(1);
  expect(secondCallback).not.toHaveBeenCalled();
});
