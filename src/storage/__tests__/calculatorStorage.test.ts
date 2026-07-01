import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateLoan as calculateLoanEngine } from '../../domain/loan/calculateLoan';
import type { LoanInput } from '../../domain/loan/types';
import { buildLoanShareMessage } from '../../domain/loan/shareSummary';
import { createLoanPdfHtml } from '../../pdf/createLoanPdfHtml';
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

const calculateLoan = (input: LoanInput) =>
  calculateLoanEngine({
    deductFirstInstallmentDelayFromTerm: false,
    ...input,
  });

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
        { installmentNo: '12', amount: '50.000' },
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
        { installmentNo: 12, amount: 50000 },
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
    expect(loadedItems[0].form.deductFirstInstallmentDelayFromTerm).toBe(false);
    expect(loadedItems[0].summary.deductFirstInstallmentDelayFromTerm).toBe(false);
  });

  it('keeps first installment delay deduction preference in recent calculations', async () => {
    const form: LoanFormSnapshot = {
      loanType: 'Bireysel İhtiyaç/Taşıt Kredisi',
      amount: '100.000',
      interestRate: '3',
      bsmv: '0',
      kkdf: '0',
      term: '24',
      creditUsageDate: new Date(2026, 5, 25),
      firstInstallmentDate: new Date(2026, 8, 25),
      deductFirstInstallmentDelayFromTerm: true,
      planType: 'standard',
      prepaidInterestAmount: '',
      customPayments: [],
    };
    const result = calculateLoanEngine({
      principal: 100000,
      term: 24,
      monthlyInterestRatePercent: 3,
      kkdfRatePercent: 0,
      bsmvRatePercent: 0,
      creditUsageDate: form.creditUsageDate,
      firstInstallmentDate: form.firstInstallmentDate,
      deductFirstInstallmentDelayFromTerm: true,
      planType: 'standard',
    });

    await addRecentCalculation(form, result, []);
    const loadedItems = await loadRecentCalculations();

    expect(loadedItems[0].form.deductFirstInstallmentDelayFromTerm).toBe(true);
    expect(loadedItems[0].summary.deductFirstInstallmentDelayFromTerm).toBe(true);
    expect(loadedItems[0].summary.firstInstallmentDelayMonths).toBe(3);
    expect(loadedItems[0].summary.deductedDelayMonths).toBe(2);
    expect(loadedItems[0].summary.effectiveInstallmentCount).toBe(22);
  });

  it('keeps interest-only installment count in recent calculations', async () => {
    const form: LoanFormSnapshot = {
      loanType: 'Bireysel İhtiyaç/Taşıt Kredisi',
      amount: '120.000',
      interestRate: '3',
      bsmv: '15',
      kkdf: '15',
      term: '12',
      creditUsageDate: new Date(2026, 5, 24),
      firstInstallmentDate: new Date(2026, 6, 24),
      planType: 'interestOnly',
      prepaidInterestAmount: '',
      interestOnlyInstallmentCount: '3',
      customPayments: [],
    };
    const result = calculateLoan({
      principal: 120000,
      term: 12,
      monthlyInterestRatePercent: 3,
      kkdfRatePercent: 15,
      bsmvRatePercent: 15,
      creditUsageDate: form.creditUsageDate,
      firstInstallmentDate: form.firstInstallmentDate,
      planType: 'interestOnly',
      interestOnlyInstallmentCount: 3,
    });

    await addRecentCalculation(form, result, []);
    const loadedItems = await loadRecentCalculations();

    expect(loadedItems[0].form.planType).toBe('interestOnly');
    expect(loadedItems[0].form.interestOnlyInstallmentCount).toBe('3');
    expect(loadedItems[0].summary.interestOnlyInstallmentCount).toBe(3);
    expect(loadedItems[0].summary.postInterestOnlyInstallmentAmount).toBe(
      result.postInterestOnlyInstallmentAmount
    );
  });

  it('keeps increasing installment fields in recent calculations', async () => {
    const form: LoanFormSnapshot = {
      loanType: 'Bireysel İhtiyaç/Taşıt Kredisi',
      amount: '100.000',
      interestRate: '2',
      bsmv: '0',
      kkdf: '0',
      term: '12',
      creditUsageDate: new Date(2026, 5, 24),
      firstInstallmentDate: new Date(2026, 6, 24),
      planType: 'increasingInstallment',
      prepaidInterestAmount: '',
      interestOnlyInstallmentCount: '',
      installmentIncreaseRatePercent: '5',
      installmentIncreaseFrequencyMonths: '12',
      installmentIncreaseStartNo: '2',
      installmentIncreaseEndNo: '10',
      customPayments: [],
    };
    const result = calculateLoan({
      principal: 100000,
      term: 12,
      monthlyInterestRatePercent: 2,
      kkdfRatePercent: 0,
      bsmvRatePercent: 0,
      creditUsageDate: form.creditUsageDate,
      firstInstallmentDate: form.firstInstallmentDate,
      planType: 'increasingInstallment',
      installmentIncreaseRatePercent: 5,
      installmentIncreaseFrequencyMonths: 12,
      installmentIncreaseStartNo: 2,
      installmentIncreaseEndNo: 10,
    });

    await addRecentCalculation(form, result, []);
    const loadedItems = await loadRecentCalculations();

    expect(loadedItems[0].form.planType).toBe('increasingInstallment');
    expect(loadedItems[0].form.installmentIncreaseRatePercent).toBe('5');
    expect(loadedItems[0].form.installmentIncreaseFrequencyMonths).toBe('12');
    expect(loadedItems[0].form.installmentIncreaseStartNo).toBe('2');
    expect(loadedItems[0].form.installmentIncreaseEndNo).toBe('10');
    expect(loadedItems[0].summary.installmentIncreaseRatePercent).toBe(5);
    expect(loadedItems[0].summary.installmentIncreaseFrequencyMonths).toBe(12);
    expect(loadedItems[0].summary.installmentIncreaseStartNo).toBe(2);
    expect(loadedItems[0].summary.installmentIncreaseEndNo).toBe(10);
    expect(loadedItems[0].summary.baseInstallmentAmount).toBe(
      result.baseInstallmentAmount
    );
    expect(loadedItems[0].summary.firstInstallmentAmount).toBe(
      result.firstInstallmentAmount
    );
    expect(loadedItems[0].summary.lastInstallmentAmount).toBe(
      result.lastInstallmentAmount
    );
  });

  it('loads old increasing installment calculations without frequency and range as yearly full-term', async () => {
    await AsyncStorage.setItem(
      RECENT_CALCULATIONS_KEY,
      JSON.stringify([
        {
          id: 'old-increasing',
          createdAt: '2026-06-24T00:00:00.000Z',
          form: {
            loanType: 'Bireysel İhtiyaç/Taşıt Kredisi',
            amount: '100.000',
            interestRate: '2',
            bsmv: '0',
            kkdf: '0',
            term: '12',
            creditUsageDate: '2026-06-24',
            firstInstallmentDate: '2026-07-24',
            planType: 'increasingInstallment',
            installmentIncreaseRatePercent: '5',
          },
          summary: {
            principal: 100000,
            term: 12,
            standardInstallment: 10000,
            firstInstallment: 7211.19,
            totalPayment: 114781.33,
            planType: 'increasingInstallment',
            installmentIncreaseRatePercent: 5,
          },
        },
      ])
    );

    const loadedItems = await loadRecentCalculations();

    expect(loadedItems[0].form.planType).toBe('increasingInstallment');
    expect(loadedItems[0].form.installmentIncreaseFrequencyMonths).toBe('12');
    expect(loadedItems[0].form.installmentIncreaseStartNo).toBe('1');
    expect(loadedItems[0].form.installmentIncreaseEndNo).toBe('12');
    expect(loadedItems[0].summary.installmentIncreaseFrequencyMonths).toBe(12);
    expect(loadedItems[0].summary.installmentIncreaseStartNo).toBe(1);
    expect(loadedItems[0].summary.installmentIncreaseEndNo).toBe(12);
  });

  it('reopens old increasing installment calculations with normalized range for calculation, PDF and share', async () => {
    await AsyncStorage.setItem(
      RECENT_CALCULATIONS_KEY,
      JSON.stringify([
        {
          id: 'old-increasing',
          createdAt: '2026-06-24T00:00:00.000Z',
          form: {
            loanType: 'Bireysel İhtiyaç/Taşıt Kredisi',
            amount: '100.000',
            interestRate: '2',
            bsmv: '0',
            kkdf: '0',
            term: '12',
            creditUsageDate: '2026-06-24',
            firstInstallmentDate: '2026-07-24',
            planType: 'increasingInstallment',
            installmentIncreaseRatePercent: '5',
          },
          summary: {
            principal: 100000,
            term: 12,
            standardInstallment: 10000,
            firstInstallment: 7211.19,
            totalPayment: 114781.33,
            planType: 'increasingInstallment',
            installmentIncreaseRatePercent: 5,
          },
        },
      ])
    );

    const loadedItems = await loadRecentCalculations();
    const form = loadedItems[0].form;
    const result = calculateLoan({
      principal: 100000,
      term: Number(form.term),
      monthlyInterestRatePercent: Number(form.interestRate),
      kkdfRatePercent: Number(form.kkdf),
      bsmvRatePercent: Number(form.bsmv),
      creditUsageDate: form.creditUsageDate,
      firstInstallmentDate: form.firstInstallmentDate,
      planType: 'increasingInstallment',
      installmentIncreaseRatePercent: Number(form.installmentIncreaseRatePercent),
      installmentIncreaseFrequencyMonths: Number(
        form.installmentIncreaseFrequencyMonths
      ),
      installmentIncreaseStartNo: Number(form.installmentIncreaseStartNo),
      installmentIncreaseEndNo: Number(form.installmentIncreaseEndNo),
    });
    const pdfHtml = createLoanPdfHtml(result);
    const shareMessage = buildLoanShareMessage(result);

    expect(result.installmentIncreaseFrequencyMonths).toBe(12);
    expect(result.installmentIncreaseStartNo).toBe(1);
    expect(result.installmentIncreaseEndNo).toBe(12);
    expect(result.schedule[result.schedule.length - 1].remainingPrincipal).toBe(0);
    expect(pdfHtml).toContain('Artış Başlangıç Taksiti');
    expect(pdfHtml).toContain('Artış Bitiş Taksiti');
    expect(shareMessage).toContain('Artış başlangıç taksiti: 1. taksit');
    expect(shareMessage).toContain('Artış bitiş taksiti: 12. taksit');

    await addRecentCalculation(form, result, loadedItems);
    const reloadedItems = await loadRecentCalculations();

    expect(reloadedItems[0].form.installmentIncreaseStartNo).toBe('1');
    expect(reloadedItems[0].form.installmentIncreaseEndNo).toBe('12');
    expect(reloadedItems[0].summary.installmentIncreaseStartNo).toBe(1);
    expect(reloadedItems[0].summary.installmentIncreaseEndNo).toBe(12);
  });
});
