import { daysBetween, startOfLocalDay } from '../../utils/dateMath';
import {
  requirePositiveDayRange,
  requireValidDate,
  sumBreakdown,
  validateTaxConfig,
} from './common';
import { assertMoney, assertRate, assertSignedMoney, decimal, roundMoney } from './money';
import type {
  CommercialRevolvingInput,
  CommercialRevolvingResult,
  RevolvingMovement,
  RevolvingPeriod,
} from './types';

const normalizeMovements = (movements: RevolvingMovement[]): RevolvingMovement[] => {
  const grouped = new Map<number, number>();
  movements.forEach((movement) => {
    const date = requireValidDate(movement.date, 'Hareket tarihi');
    assertSignedMoney(movement.amount, 'Hareket tutarı');
    const key = date.getTime();
    grouped.set(key, roundMoney((grouped.get(key) ?? 0) + movement.amount));
  });
  return [...grouped.entries()]
    .filter(([, amount]) => amount !== 0)
    .sort(([first], [second]) => first - second)
    .map(([timestamp, amount]) => ({ date: new Date(timestamp), amount }));
};

export const calculateCommercialRevolving = (
  input: CommercialRevolvingInput
): CommercialRevolvingResult => {
  if (input.mode !== 'simple' && input.mode !== 'movements') {
    throw new Error('Rotatif hesaplama biçimi geçerli değildir.');
  }
  assertRate(input.annualInterestRatePercent, 'Yıllık faiz oranı');
  validateTaxConfig(input);
  const startDate = requireValidDate(input.startDate, 'Başlangıç tarihi');
  const endDate = requireValidDate(input.endDate, 'Bitiş tarihi');
  const totalDays = requirePositiveDayRange(
    startDate,
    endDate,
    'Başlangıç tarihi',
    'Bitiş tarihi'
  );

  const movements = input.mode === 'simple'
    ? [{ date: startDate, amount: input.principal ?? 0 }]
    : normalizeMovements(input.movements ?? []);
  if (input.mode === 'simple') {
    assertMoney(input.principal ?? 0, 'Kullanılan tutar');
  }
  if (movements.length === 0) {
    throw new Error('En az bir hesap hareketi eklenmelidir.');
  }
  movements.forEach((movement) => {
    if (movement.date < startDate || movement.date > endDate) {
      throw new Error('Hareket tarihleri hesap dönemi içinde olmalıdır.');
    }
  });

  const periods: RevolvingPeriod[] = [];
  let balance = 0;
  let cursor = startDate;
  let exactTotalInterest = decimal(0);
  movements.forEach((movement) => {
    const intervalDays = daysBetween(cursor, movement.date);
    if (intervalDays > 0 && balance > 0) {
      const exactInterest = decimal(balance)
        .mul(input.annualInterestRatePercent)
        .mul(intervalDays)
        .div(36_000);
      const interest = roundMoney(exactInterest);
      periods.push({
        startDate: cursor,
        endDate: movement.date,
        openingBalance: balance,
        dayCount: intervalDays,
        interest,
      });
      exactTotalInterest = exactTotalInterest.add(exactInterest);
    }
    balance = roundMoney(balance + movement.amount);
    if (balance < 0) {
      throw new Error('Geri ödeme, hareket tarihindeki kredi bakiyesini aşamaz.');
    }
    if (balance > 1_000_000_000_000) {
      throw new Error('Hesap bakiyesi desteklenen güvenli tutar sınırını aşıyor.');
    }
    cursor = startOfLocalDay(movement.date);
  });
  const finalDays = daysBetween(cursor, endDate);
  if (finalDays > 0 && balance > 0) {
    const exactInterest = decimal(balance)
      .mul(input.annualInterestRatePercent)
      .mul(finalDays)
      .div(36_000);
    const interest = roundMoney(exactInterest);
    periods.push({
      startDate: cursor,
      endDate,
      openingBalance: balance,
      dayCount: finalDays,
      interest,
    });
    exactTotalInterest = exactTotalInterest.add(exactInterest);
  }
  const totalInterest = roundMoney(exactTotalInterest);
  const displayedInterest = roundMoney(
    periods.reduce((sum, period) => sum + period.interest, 0)
  );
  const roundingDifference = roundMoney(totalInterest - displayedInterest);
  if (periods.length > 0 && roundingDifference !== 0) {
    const lastPeriod = periods[periods.length - 1];
    lastPeriod.interest = roundMoney(lastPeriod.interest + roundingDifference);
  }
  const breakdown = sumBreakdown(totalInterest, input);
  return {
    productType: 'commercial_revolving',
    input,
    totalDays,
    closingBalance: balance,
    periods,
    ...breakdown,
    dayCountConvention: 'ACT/360',
  };
};
