import { calculateLoan as calculateLoanEngine } from '../../domain/loan/calculateLoan';
import type { LoanInput } from '../../domain/loan/types';
import { createLoanPdfFileName } from '../exportLoanPdf';

const calculateLoan = (input: LoanInput) =>
  calculateLoanEngine({
    deductFirstInstallmentDelayFromTerm: false,
    ...input,
  });

describe('createLoanPdfFileName', () => {
  it('includes amount, term, dates and unique id', () => {
    const result = calculateLoan({
      principal: 1000000,
      term: 60,
      monthlyInterestRatePercent: 2.79,
      kkdfRatePercent: 0,
      bsmvRatePercent: 0,
      creditUsageDate: new Date(2026, 5, 12),
      firstInstallmentDate: new Date(2026, 6, 12),
    });

    expect(createLoanPdfFileName(result, 'abc123')).toBe(
      'kredi-odeme-plani-1000000tl-60ay-kullanim-2026-06-12-ilk-2026-07-12-abc123.pdf'
    );
  });
});
