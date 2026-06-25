import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateLoan } from '../../domain/loan/calculateLoan';
import {
  addRecentCalculation,
  loadRecentCalculations,
  type LoanFormSnapshot,
} from '../calculatorStorage';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();

  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store.clear();
        return Promise.resolve();
      }),
    },
  };
});

const RECENT_CALCULATIONS_KEY = 'bankaci.recentCalculations.v1';

describe('calculatorStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('keeps custom payment rows in recent calculations', async () => {
    const form: LoanFormSnapshot = {
      loanType: 'Bireysel İhtiyaç/Taşıt Kredisi',
      amount: '120.000',
      interestRate: '3',
      bsmv: '0',
      kkdf: '0',
      term: '12',
      creditUsageDate: new Date(2026, 5, 24),
      firstInstallmentDate: new Date(2026, 6, 24),
      planType: 'customPayment',
      prepaidInterestAmount: '',
      customPayments: [
        { installmentNo: '1', amount: '10.000' },
        { installmentNo: '10', amount: '50.000' },
      ],
    };
    const result = calculateLoan({
      principal: 120000,
      term: 12,
      monthlyInterestRatePercent: 3,
      kkdfRatePercent: 0,
      bsmvRatePercent: 0,
      creditUsageDate: form.creditUsageDate,
      firstInstallmentDate: form.firstInstallmentDate,
      planType: 'customPayment',
      customPayments: [
        { installmentNo: 1, amount: 10000 },
        { installmentNo: 10, amount: 50000 },
      ],
    });

    await addRecentCalculation(form, result, []);
    const loadedItems = await loadRecentCalculations();

    expect(loadedItems[0].form.planType).toBe('customPayment');
    expect(loadedItems[0].form.customPayments).toEqual(form.customPayments);
    expect(loadedItems[0].summary.automaticInstallmentAmount).toBe(
      result.automaticInstallmentAmount
    );
    expect(loadedItems[0].summary.customPaymentCount).toBe(2);
  });

  it('loads old recent calculations without planType as standard', async () => {
    await AsyncStorage.setItem(
      RECENT_CALCULATIONS_KEY,
      JSON.stringify([
        {
          id: 'old',
          createdAt: '2026-06-24T00:00:00.000Z',
          form: {
            loanType: 'Bireysel İhtiyaç/Taşıt Kredisi',
            amount: '100.000',
            interestRate: '3',
            bsmv: '15',
            kkdf: '15',
            term: '12',
            creditUsageDate: '2026-06-24',
            firstInstallmentDate: '2026-07-24',
          },
          summary: {
            principal: 100000,
            term: 12,
            standardInstallment: 10000,
            firstInstallment: 10000,
            totalPayment: 120000,
          },
        },
      ])
    );

    const loadedItems = await loadRecentCalculations();

    expect(loadedItems[0].form.planType).toBe('standard');
    expect(loadedItems[0].summary.planType).toBe('standard');
    expect(loadedItems[0].form.customPayments).toEqual([]);
  });
});
