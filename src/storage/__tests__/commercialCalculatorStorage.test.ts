import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateCommercialSpot } from '../../domain/commercial/calculateSpot';
import { getCommercialCalculations, saveCommercialCalculation } from '../commercialCalculatorStorage';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return { __esModule: true, default: {
    getItem: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => { store.set(key, value); return Promise.resolve(); }),
    clear: jest.fn(() => { store.clear(); return Promise.resolve(); }),
  } };
});

const input = {
  productType: 'commercial_spot' as const, principal: 100_000,
  annualInterestRatePercent: 15, creditUsageDate: new Date(2026, 0, 1),
  maturityDate: new Date(2026, 0, 31), bsmvRatePercent: 5,
  kkdfRatePercent: 0, otherTaxRatePercent: 0,
};

describe('commercialCalculatorStorage', () => {
  beforeEach(async () => { await AsyncStorage.clear(); jest.clearAllMocks(); });

  it('round-trips dates as Date objects and keeps result/input consistent', async () => {
    await saveCommercialCalculation(input, calculateCommercialSpot(input));
    const [loaded] = await getCommercialCalculations();
    if (loaded.input.productType !== 'commercial_spot') throw new Error('expected spot');
    expect(loaded.input.creditUsageDate).toBeInstanceOf(Date);
    expect(loaded.input.maturityDate).toBeInstanceOf(Date);
    expect(loaded.result.input).toBe(loaded.input);
    expect(loaded.result.productType).toBe('commercial_spot');
  });

  it('keeps only the latest 20 calculations', async () => {
    for (let index = 0; index < 21; index += 1) {
      const next = { ...input, principal: 100_000 + index };
      await saveCommercialCalculation(next, calculateCommercialSpot(next));
    }
    const loaded = await getCommercialCalculations();
    if (loaded.some((item) => item.input.productType !== 'commercial_spot')) throw new Error('expected spots');
    expect(loaded).toHaveLength(20);
    expect((loaded[0].input as typeof input).principal).toBe(100_020);
    expect((loaded.at(-1)?.input as typeof input).principal).toBe(100_001);
  });

  it('fails closed to an empty history when storage is corrupted', async () => {
    await AsyncStorage.setItem('@bankaci/commercial-calculations/v1', '{broken');
    await expect(getCommercialCalculations()).resolves.toEqual([]);
  });
});
