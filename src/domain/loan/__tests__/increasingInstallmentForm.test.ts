import {
  parseInstallmentIncreaseFrequencyMonths,
  parseInstallmentIncreaseRatePercent,
} from '../increasingInstallmentForm';

describe('increasingInstallmentForm', () => {
  it('accepts dot and comma decimal separators', () => {
    expect(parseInstallmentIncreaseRatePercent('2,5')).toBe(2.5);
    expect(parseInstallmentIncreaseRatePercent('2.5')).toBe(2.5);
  });

  it('rejects empty, zero and negative increase rates', () => {
    expect(() => parseInstallmentIncreaseRatePercent('')).toThrow(
      'boş olamaz'
    );
    expect(() => parseInstallmentIncreaseRatePercent('0')).toThrow('0 olamaz');
    expect(() => parseInstallmentIncreaseRatePercent('-1')).toThrow(
      'negatif olamaz'
    );
  });

  it('rejects malformed increase rates', () => {
    expect(() => parseInstallmentIncreaseRatePercent('2,5,1')).toThrow(
      'geçerli olmalıdır'
    );
    expect(() => parseInstallmentIncreaseRatePercent('abc')).toThrow(
      'geçerli olmalıdır'
    );
  });

  it('accepts integer increase frequency values', () => {
    expect(parseInstallmentIncreaseFrequencyMonths('12', 60)).toBe(12);
  });

  it('rejects invalid increase frequency values', () => {
    expect(() => parseInstallmentIncreaseFrequencyMonths('', 12)).toThrow(
      'boş olamaz'
    );
    expect(() => parseInstallmentIncreaseFrequencyMonths('0', 12)).toThrow(
      '0 olamaz'
    );
    expect(() => parseInstallmentIncreaseFrequencyMonths('-1', 12)).toThrow(
      'negatif olamaz'
    );
    expect(() => parseInstallmentIncreaseFrequencyMonths('2,5', 12)).toThrow(
      'tam sayı'
    );
    expect(() => parseInstallmentIncreaseFrequencyMonths('13', 12)).toThrow(
      'vadeden büyük'
    );
  });
});
