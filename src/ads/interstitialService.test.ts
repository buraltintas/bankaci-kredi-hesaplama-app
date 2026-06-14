import type { InterstitialActionName } from './adConfig';

const listeners: Record<string, ((payload?: unknown) => void)[]> = {};
let mockAdLoaded = false;
let mockShow = jest.fn<Promise<void>, []>(() => {
  createdAd?.emit('closed');
  return Promise.resolve();
});
let createdAd: { emit: (event: string, payload?: unknown) => void } | null = null;
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
      const ad = {
        get loaded() {
          return mockAdLoaded;
        },
        addAdEventListener: jest.fn((event: string, callback: (payload?: unknown) => void) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(callback);
        }),
        load: jest.fn(),
        show: mockShow,
      };
      createdAd = {
        emit: (event: string, payload?: unknown) => {
          listeners[event]?.forEach((callback) => callback(payload));
        },
      };
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
  Object.keys(listeners).forEach((key) => {
    delete listeners[key];
  });
  createdAd = null;
  mockAdLoaded = false;
  mockIsConnected = true;
  mockIsInternetReachable = true;
  mockAppOwnership = null;
  mockShow = jest.fn<Promise<void>, []>(() => {
    createdAd?.emit('closed');
    return Promise.resolve();
  });
  jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
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

test('skips first eligible action and continues without blocking', async () => {
  const service = loadService();
  const callback = jest.fn(() => Promise.resolve());

  await service.initializeInterstitialAds();
  createdAd?.emit('loaded');
  mockAdLoaded = true;

  await run(service, 'share', callback);

  expect(callback).toHaveBeenCalledTimes(1);
  expect(mockShow).not.toHaveBeenCalled();
});

test.skip('shows loaded interstitial on later action then runs callback', async () => {
  const service = loadService();
  const firstCallback = jest.fn(() => Promise.resolve());
  const secondCallback = jest.fn(() => Promise.resolve());

  await service.initializeInterstitialAds();
  createdAd?.emit('loaded');
  mockAdLoaded = true;

  await run(service, 'share', firstCallback);
  await run(service, 'pdf', secondCallback);

  expect(mockShow).toHaveBeenCalledTimes(1);
  expect(secondCallback).toHaveBeenCalledTimes(1);
});

test.skip('frequency cap prevents back to back ads', async () => {
  const service = loadService();
  const callback = jest.fn(() => Promise.resolve());

  await service.initializeInterstitialAds();
  createdAd?.emit('loaded');
  mockAdLoaded = true;

  await run(service, 'share', callback);
  await run(service, 'pdf', callback);
  await run(service, 'share', callback);

  expect(mockShow).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledTimes(3);
});

test.skip('show failure does not block action', async () => {
  mockShow = jest.fn<Promise<void>, []>(() => Promise.reject(new Error('show failed')));
  const service = loadService();
  const firstCallback = jest.fn(() => Promise.resolve());
  const secondCallback = jest.fn(() => Promise.resolve());

  await service.initializeInterstitialAds();
  createdAd?.emit('loaded');
  mockAdLoaded = true;

  await run(service, 'share', firstCallback);
  await run(service, 'pdf', secondCallback);

  expect(mockShow).toHaveBeenCalledTimes(1);
  expect(secondCallback).toHaveBeenCalledTimes(1);
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
