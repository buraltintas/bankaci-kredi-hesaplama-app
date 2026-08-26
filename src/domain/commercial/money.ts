import Decimal from 'decimal.js';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export const MAX_COMMERCIAL_MONEY = 1_000_000_000_000;
const MAX_COMMERCIAL_RESULT = 1_000_000_000_000_000;

export const decimal = (value: Decimal.Value): Decimal => new Decimal(value);

export const roundMoneyDecimal = (value: Decimal.Value): Decimal =>
  decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const roundMoney = (value: Decimal.Value): number => {
  const result = roundMoneyDecimal(value).toNumber();
  if (!Number.isFinite(result) || Math.abs(result) > MAX_COMMERCIAL_RESULT) {
    throw new Error('Hesaplama sonucu desteklenen güvenli tutar sınırını aşıyor.');
  }
  return result;
};

export const assertMoney = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value <= 0 || value > MAX_COMMERCIAL_MONEY) {
    throw new Error(`${label} 0'dan büyük ve geçerli bir tutar olmalıdır.`);
  }
};

export const assertSignedMoney = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value === 0 || Math.abs(value) > MAX_COMMERCIAL_MONEY) {
    throw new Error(`${label} sıfırdan farklı ve geçerli bir tutar olmalıdır.`);
  }
};

export const assertRate = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value < 0 || value > 1_000) {
    throw new Error(`${label} 0 ile 1.000 arasında olmalıdır.`);
  }
};
