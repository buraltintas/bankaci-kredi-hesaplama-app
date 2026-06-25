import { parseInterestOnlyInstallmentCount } from '../interestOnlyForm';

describe('interestOnlyForm', () => {
  it('parses a valid interest-only installment count', () => {
    expect(parseInterestOnlyInstallmentCount('6', 36)).toBe(6);
  });

  it('rejects empty, zero, negative, decimal and out-of-range values', () => {
    expect(() => parseInterestOnlyInstallmentCount('', 12)).toThrow('boş olamaz');
    expect(() => parseInterestOnlyInstallmentCount('0', 12)).toThrow('0 olamaz');
    expect(() => parseInterestOnlyInstallmentCount('-1', 12)).toThrow(
      'negatif olamaz'
    );
    expect(() => parseInterestOnlyInstallmentCount('2,5', 12)).toThrow(
      'tam sayı'
    );
    expect(() => parseInterestOnlyInstallmentCount('12', 12)).toThrow(
      'vade ile aynı'
    );
    expect(() => parseInterestOnlyInstallmentCount('13', 12)).toThrow(
      'vadeden büyük'
    );
  });
});
