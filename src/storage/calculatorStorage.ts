import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LoanCalculationResult, LoanPlanType } from '../domain/loan/types';
import { formatDateForFileName, startOfLocalDay } from '../utils/dateMath';

const RECENT_CALCULATIONS_KEY = 'bankaci.recentCalculations.v1';
const PDF_CONTACT_KEY = 'bankaci.pdfContact.v1';
const RECENT_CALCULATIONS_LIMIT = 20;

export type LoanFormSnapshot = {
  loanType: string;
  amount: string;
  interestRate: string;
  bsmv: string;
  kkdf: string;
  term: string;
  creditUsageDate: Date;
  firstInstallmentDate: Date;
  planType?: LoanPlanType;
  prepaidInterestAmount?: string;
};

export type PdfContactPreferences = {
  includeContactInfo: boolean;
  fullName: string;
  phone: string;
};

export type RecentCalculation = {
  id: string;
  createdAt: string;
  form: LoanFormSnapshot;
  summary: {
    principal: number;
    term: number;
    standardInstallment: number;
    firstInstallment: number;
    totalPayment: number;
    planType?: LoanPlanType;
    prepaidInterestInput?: number;
    realizedPrepaidInterest?: number;
  };
};

type StoredLoanFormSnapshot = Omit<
  LoanFormSnapshot,
  'creditUsageDate' | 'firstInstallmentDate'
> & {
  creditUsageDate: string;
  firstInstallmentDate: string;
};

type StoredRecentCalculation = Omit<RecentCalculation, 'form'> & {
  form: StoredLoanFormSnapshot;
};

const createId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const parseStoredDate = (value: unknown): Date | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = startOfLocalDay(new Date(year, monthIndex, day));

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const serializeForm = (form: LoanFormSnapshot): StoredLoanFormSnapshot => ({
  ...form,
  creditUsageDate: formatDateForFileName(form.creditUsageDate),
  firstInstallmentDate: formatDateForFileName(form.firstInstallmentDate),
});

const deserializeForm = (
  form: StoredLoanFormSnapshot
): LoanFormSnapshot | null => {
  const creditUsageDate = parseStoredDate(form.creditUsageDate);
  const firstInstallmentDate = parseStoredDate(form.firstInstallmentDate);

  if (!creditUsageDate || !firstInstallmentDate) {
    return null;
  }

  return {
    loanType: String(form.loanType ?? ''),
    amount: String(form.amount ?? ''),
    interestRate: String(form.interestRate ?? ''),
    bsmv: String(form.bsmv ?? ''),
    kkdf: String(form.kkdf ?? ''),
    term: String(form.term ?? ''),
    creditUsageDate,
    firstInstallmentDate,
    planType: form.planType === 'prepaidInterest' ? 'prepaidInterest' : 'standard',
    prepaidInterestAmount: String(form.prepaidInterestAmount ?? ''),
  };
};

const deserializeRecentCalculation = (
  item: StoredRecentCalculation
): RecentCalculation | null => {
  const form = deserializeForm(item.form);

  if (!form || !item.summary || typeof item.id !== 'string') {
    return null;
  }

  return {
    id: item.id,
    createdAt: String(item.createdAt ?? ''),
    form,
    summary: {
      principal: Number(item.summary.principal) || 0,
      term: Number(item.summary.term) || 0,
      standardInstallment: Number(item.summary.standardInstallment) || 0,
      firstInstallment: Number(item.summary.firstInstallment) || 0,
      totalPayment: Number(item.summary.totalPayment) || 0,
      planType:
        item.summary.planType === 'prepaidInterest' ? 'prepaidInterest' : 'standard',
      prepaidInterestInput: Number(item.summary.prepaidInterestInput) || 0,
      realizedPrepaidInterest:
        Number(item.summary.realizedPrepaidInterest) || 0,
    },
  };
};

export const loadRecentCalculations = async (): Promise<RecentCalculation[]> => {
  try {
    const rawValue = await AsyncStorage.getItem(RECENT_CALCULATIONS_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .map(deserializeRecentCalculation)
      .filter((item): item is RecentCalculation => Boolean(item))
      .slice(0, RECENT_CALCULATIONS_LIMIT);
  } catch {
    return [];
  }
};

const isSameFormSnapshot = (
  a: LoanFormSnapshot,
  b: LoanFormSnapshot
): boolean =>
  a.loanType === b.loanType &&
  a.amount === b.amount &&
  a.interestRate === b.interestRate &&
  a.bsmv === b.bsmv &&
  a.kkdf === b.kkdf &&
  a.term === b.term &&
  (a.planType ?? 'standard') === (b.planType ?? 'standard') &&
  String(a.prepaidInterestAmount ?? '') ===
    String(b.prepaidInterestAmount ?? '') &&
  formatDateForFileName(a.creditUsageDate) ===
    formatDateForFileName(b.creditUsageDate) &&
  formatDateForFileName(a.firstInstallmentDate) ===
    formatDateForFileName(b.firstInstallmentDate);

export const addRecentCalculation = async (
  form: LoanFormSnapshot,
  result: LoanCalculationResult,
  currentItems: RecentCalculation[]
): Promise<RecentCalculation[]> => {
  const summary = {
    principal: result.input.principal,
    term: result.input.term,
    standardInstallment: result.standardInstallment,
    firstInstallment: result.firstInstallment,
    totalPayment: result.totalPayment,
    planType: result.planType,
    prepaidInterestInput: result.prepaidInterestInput,
    realizedPrepaidInterest: result.realizedPrepaidInterest,
  };
  const now = new Date().toISOString();

  // If an identical form already exists, refresh its timestamp and move it to
  // the top instead of creating a duplicate entry.
  const existingIndex = currentItems.findIndex((item) =>
    isSameFormSnapshot(item.form, form)
  );

  let nextItems: RecentCalculation[];
  if (existingIndex >= 0) {
    const existing = currentItems[existingIndex];
    const refreshed: RecentCalculation = {
      ...existing,
      createdAt: now,
      form,
      summary,
    };
    const rest = currentItems.filter((_, index) => index !== existingIndex);
    nextItems = [refreshed, ...rest].slice(0, RECENT_CALCULATIONS_LIMIT);
  } else {
    const nextItem: RecentCalculation = {
      id: createId(),
      createdAt: now,
      form,
      summary,
    };
    nextItems = [nextItem, ...currentItems].slice(0, RECENT_CALCULATIONS_LIMIT);
  }

  const storedItems: StoredRecentCalculation[] = nextItems.map((item) => ({
    ...item,
    form: serializeForm(item.form),
  }));

  await AsyncStorage.setItem(
    RECENT_CALCULATIONS_KEY,
    JSON.stringify(storedItems)
  );

  return nextItems;
};

export const removeRecentCalculation = async (
  id: string,
  currentItems: RecentCalculation[]
): Promise<RecentCalculation[]> => {
  const nextItems = currentItems.filter((item) => item.id !== id);
  const storedItems: StoredRecentCalculation[] = nextItems.map((item) => ({
    ...item,
    form: serializeForm(item.form),
  }));

  await AsyncStorage.setItem(
    RECENT_CALCULATIONS_KEY,
    JSON.stringify(storedItems)
  );

  return nextItems;
};

export const loadPdfContactPreferences =
  async (): Promise<PdfContactPreferences | null> => {
    try {
      const rawValue = await AsyncStorage.getItem(PDF_CONTACT_KEY);
      const parsedValue = rawValue ? JSON.parse(rawValue) : null;

      if (!parsedValue || typeof parsedValue !== 'object') {
        return null;
      }

      return {
        includeContactInfo: Boolean(parsedValue.includeContactInfo),
        fullName: String(parsedValue.fullName ?? ''),
        phone: String(parsedValue.phone ?? ''),
      };
    } catch {
      return null;
    }
  };

export const savePdfContactPreferences = async (
  preferences: PdfContactPreferences
): Promise<void> => {
  await AsyncStorage.setItem(PDF_CONTACT_KEY, JSON.stringify(preferences));
};
