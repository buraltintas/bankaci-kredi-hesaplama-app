import type { CustomerInfo } from 'react-native-purchases';
import {
  __resetPurchasesForTests,
  identifyRevenueCatUser,
} from '../purchases';
import { __resetPremiumStoreForTests, getIsPremium } from '../premiumStore';

const activeInfo = { entitlements: { active: { premium: {} } } } as unknown as CustomerInfo;
const freeInfo = { entitlements: { active: {} } } as unknown as CustomerInfo;

const mockPurchases = {
  configure: jest.fn(),
  addCustomerInfoUpdateListener: jest.fn(),
  getCustomerInfo: jest.fn(),
  logIn: jest.fn(),
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

  it('keeps login and entitlement successful when the email attribute fails', async () => {
    mockPurchases.logIn.mockResolvedValue({ customerInfo: activeInfo, created: false });
    mockPurchases.setEmail.mockRejectedValue(new Error('offline'));

    await expect(
      identifyRevenueCatUser('rc_verified_user', 'bankaci@example.com')
    ).resolves.toBe(true);

    expect(getIsPremium()).toBe(true);
  });
});
