import type { CustomerInfo } from 'react-native-purchases';
import {
  __resetPurchasesForTests,
  identifyRevenueCatUser,
  initializePurchases,
  refreshPremiumStatus,
  resetRevenueCatToGuest,
} from '../purchases';
import { __resetPremiumStoreForTests, getIsPremium } from '../premiumStore';

const activeInfo = { entitlements: { active: { premium: {} } } } as unknown as CustomerInfo;
const freeInfo = { entitlements: { active: {} } } as unknown as CustomerInfo;

const mockPurchases = {
  configure: jest.fn(),
  addCustomerInfoUpdateListener: jest.fn(),
  getCustomerInfo: jest.fn(),
  getAppUserID: jest.fn(),
  isAnonymous: jest.fn(),
  invalidateCustomerInfoCache: jest.fn(),
  logIn: jest.fn(),
  logOut: jest.fn(),
  setEmail: jest.fn(),
  syncPurchasesForResult: jest.fn(),
};

jest.mock('expo-constants', () => ({ __esModule: true, default: { appOwnership: null } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('react-native-purchases', () => ({ __esModule: true, default: mockPurchases }));

describe('RevenueCat member identity migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetPurchasesForTests();
    __resetPremiumStoreForTests();
    mockPurchases.getCustomerInfo.mockResolvedValue(activeInfo);
    mockPurchases.getAppUserID.mockResolvedValue('$RCAnonymousID:test');
    mockPurchases.isAnonymous.mockResolvedValue(true);
  });

  it('syncs an existing anonymous purchase if login temporarily loses it', async () => {
    mockPurchases.logIn.mockResolvedValue({ customerInfo: freeInfo, created: false });
    mockPurchases.syncPurchasesForResult.mockResolvedValue({ customerInfo: activeInfo });

    await expect(
      identifyRevenueCatUser('rc_verified_user', ' BANKACI@Example.com ')
    ).resolves.toBe(true);

    expect(mockPurchases.logIn).toHaveBeenCalledWith('rc_verified_user');
    expect(mockPurchases.setEmail).toHaveBeenCalledWith('bankaci@example.com');
    expect(mockPurchases.syncPurchasesForResult).toHaveBeenCalledTimes(1);
    expect(getIsPremium()).toBe(true);
  });

  it('does not touch the receipt when the verified identity already has premium', async () => {
    mockPurchases.logIn.mockResolvedValue({ customerInfo: activeInfo, created: false });

    await expect(identifyRevenueCatUser('rc_verified_user')).resolves.toBe(true);

    expect(mockPurchases.syncPurchasesForResult).not.toHaveBeenCalled();
  });

  it('does not transfer premium while switching between identified accounts', async () => {
    mockPurchases.getAppUserID.mockResolvedValue('rc_first_member');
    mockPurchases.isAnonymous.mockResolvedValue(false);
    mockPurchases.logIn.mockResolvedValue({
      customerInfo: freeInfo,
      created: false,
    });

    await expect(
      identifyRevenueCatUser('rc_second_member', 'second@example.com')
    ).resolves.toBe(false);

    expect(mockPurchases.logIn).toHaveBeenCalledWith('rc_second_member');
    expect(mockPurchases.syncPurchasesForResult).not.toHaveBeenCalled();
    expect(getIsPremium()).toBe(false);
  });

  it('configures directly with the verified identity when it is known at startup', async () => {
    mockPurchases.getAppUserID.mockResolvedValue('rc_verified_user');

    await identifyRevenueCatUser('rc_verified_user');

    expect(mockPurchases.configure).toHaveBeenCalledWith({
      apiKey: expect.any(String),
      appUserID: 'rc_verified_user',
    });
    expect(mockPurchases.logIn).not.toHaveBeenCalled();
  });

  it('keeps login and entitlement successful when the email attribute fails', async () => {
    mockPurchases.logIn.mockResolvedValue({ customerInfo: activeInfo, created: false });
    mockPurchases.setEmail.mockRejectedValue(new Error('offline'));

    await expect(
      identifyRevenueCatUser('rc_verified_user', 'bankaci@example.com')
    ).resolves.toBe(true);

    expect(getIsPremium()).toBe(true);
  });

  it('force-refreshes support grants without restoring the store receipt', async () => {
    await expect(refreshPremiumStatus(true)).resolves.toBe(true);

    expect(mockPurchases.invalidateCustomerInfoCache).toHaveBeenCalledTimes(1);
    expect(mockPurchases.getCustomerInfo).toHaveBeenCalledTimes(1);
  });
});

describe('anonymous store-entitlement restore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetPurchasesForTests();
    __resetPremiumStoreForTests();
    mockPurchases.getAppUserID.mockResolvedValue('$RCAnonymousID:fresh');
    mockPurchases.isAnonymous.mockResolvedValue(true);
  });

  it('restores a store purchase on a fresh anonymous install without a prompt', async () => {
    // getCustomerInfo is empty on a new install; the receipt still owns premium.
    mockPurchases.getCustomerInfo.mockResolvedValue(freeInfo);
    mockPurchases.syncPurchasesForResult.mockResolvedValue({ customerInfo: activeInfo });

    await initializePurchases();

    expect(mockPurchases.syncPurchasesForResult).toHaveBeenCalledTimes(1);
    expect(getIsPremium()).toBe(true);
  });

  it('does not sync when the entitlement is already known', async () => {
    mockPurchases.getCustomerInfo.mockResolvedValue(activeInfo);

    await initializePurchases();

    expect(mockPurchases.syncPurchasesForResult).not.toHaveBeenCalled();
    expect(getIsPremium()).toBe(true);
  });

  it('does not sync for an identified (logged-in) startup', async () => {
    mockPurchases.getCustomerInfo.mockResolvedValue(freeInfo);
    mockPurchases.isAnonymous.mockResolvedValue(false);

    await initializePurchases('rc_verified_user');

    expect(mockPurchases.syncPurchasesForResult).not.toHaveBeenCalled();
  });

  it('keeps store premium after logout by restoring the guest identity', async () => {
    // A premium member signs out; logOut lands on a fresh anonymous id whose
    // customerInfo is empty, but the device's store account still owns it.
    mockPurchases.isAnonymous
      .mockResolvedValueOnce(false) // still identified when logout begins
      .mockResolvedValue(true); // anonymous afterwards
    mockPurchases.logOut.mockResolvedValue(freeInfo);
    mockPurchases.syncPurchasesForResult.mockResolvedValue({ customerInfo: activeInfo });

    await resetRevenueCatToGuest();

    expect(mockPurchases.logOut).toHaveBeenCalledTimes(1);
    expect(mockPurchases.syncPurchasesForResult).toHaveBeenCalledTimes(1);
    expect(getIsPremium()).toBe(true);
  });
});
