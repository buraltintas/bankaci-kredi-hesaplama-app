import { addMonths, daysBetween } from '../../utils/dateMath';
import { roundToCents } from '../../utils/round';
import type {
  BrokenPeriodInfo,
  LoanCalculationResult,
  LoanInput,
  LoanPlanType,
  PaymentScheduleItem,
} from './types';

const DISCOUNTED_RATE_DISPLAY_DECIMALS = 3;
const CUSTOM_PAYMENT_MAX_ITERATIONS = 80;

type CustomPaymentMap = Map<number, number>;

const calculateStandardInstallment = (
  principal: number,
  term: number,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number
): number => {
  const effectiveMonthlyRate = monthlyInterestRate * (1 + kkdfRate + bsmvRate);

  if (effectiveMonthlyRate === 0) {
    return roundToCents(principal / term);
  }

  const power = Math.pow(1 + effectiveMonthlyRate, term);

  return roundToCents(
    (principal * effectiveMonthlyRate * power) / (power - 1)
  );
};

const calculateAnnuityFactor = (
  term: number,
  effectiveMonthlyRate: number
): number => {
  if (effectiveMonthlyRate === 0) {
    return term;
  }

  return (1 - Math.pow(1 + effectiveMonthlyRate, -term)) / effectiveMonthlyRate;
};

const solveMonthlyRateForInstallment = (
  principal: number,
  term: number,
  targetInstallment: number,
  kkdfRate: number,
  bsmvRate: number,
  maxMonthlyRate: number
): number => {
  if (targetInstallment <= principal / term) {
    return 0;
  }

  let low = 0;
  let high = Math.max(maxMonthlyRate, 0.0001);

  while (
    calculateStandardInstallment(principal, term, high, kkdfRate, bsmvRate) <
    targetInstallment
  ) {
    high *= 2;
  }

  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (low + high) / 2;
    const installment = calculateStandardInstallment(
      principal,
      term,
      middle,
      kkdfRate,
      bsmvRate
    );

    if (installment > targetInstallment) {
      high = middle;
    } else {
      low = middle;
    }
  }

  return (low + high) / 2;
};

const roundRateUpToDisplayPrecision = (monthlyInterestRate: number): number => {
  const multiplier = Math.pow(10, DISCOUNTED_RATE_DISPLAY_DECIMALS);
  const percentValue = monthlyInterestRate * 100;

  return Math.ceil((percentValue - Number.EPSILON) * multiplier) / multiplier / 100;
};

const formatApproximateCurrency = (value: number): string =>
  roundToCents(value).toLocaleString('tr-TR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

const normalizeCustomPayments = (input: LoanInput): CustomPaymentMap => {
  if (!input.customPayments || input.customPayments.length === 0) {
    throw new Error('Özel ödeme planı için en az bir özel taksit girilmelidir.');
  }

  const customPaymentMap: CustomPaymentMap = new Map();

  input.customPayments.forEach((payment) => {
    if (
      !Number.isInteger(payment.installmentNo) ||
      payment.installmentNo < 1 ||
      payment.installmentNo > input.term
    ) {
      throw new Error('Özel ödeme taksit numarası 1 ile vade arasında olmalıdır.');
    }

    if (customPaymentMap.has(payment.installmentNo)) {
      throw new Error('Aynı taksit için birden fazla özel ödeme girilemez.');
    }

    if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
      throw new Error('Özel taksit tutarı pozitif olmalıdır.');
    }

    customPaymentMap.set(payment.installmentNo, roundToCents(payment.amount));
  });

  return customPaymentMap;
};

const buildStandardSchedule = (
  input: LoanInput,
  standardInstallment: number,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number
): PaymentScheduleItem[] => {
  let remainingPrincipal = input.principal;

  return Array.from({ length: input.term }, (_, index) => {
    const installmentNumber = index + 1;
    const isLastInstallment = installmentNumber === input.term;
    const interest = roundToCents(remainingPrincipal * monthlyInterestRate);
    const kkdf = roundToCents(interest * kkdfRate);
    const bsmv = roundToCents(interest * bsmvRate);
    const calculatedPrincipal = roundToCents(
      standardInstallment - interest - kkdf - bsmv
    );
    const principal = isLastInstallment
      ? roundToCents(remainingPrincipal)
      : calculatedPrincipal;
    const installment = isLastInstallment
      ? roundToCents(principal + interest + kkdf + bsmv)
      : standardInstallment;

    remainingPrincipal = roundToCents(remainingPrincipal - principal);

    if (isLastInstallment || Math.abs(remainingPrincipal) < 0.01) {
      remainingPrincipal = 0;
    }

    return {
      installmentNumber,
      date: addMonths(input.firstInstallmentDate, index),
      installment,
      principal,
      interest,
      kkdf,
      bsmv,
      remainingPrincipal,
    };
  });
};

const buildEqualPrincipalSchedule = (
  input: LoanInput,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number
): PaymentScheduleItem[] => {
  let remainingPrincipal = input.principal;
  const monthlyPrincipalAmount = roundToCents(input.principal / input.term);

  return Array.from({ length: input.term }, (_, index) => {
    const installmentNumber = index + 1;
    const isLastInstallment = installmentNumber === input.term;
    const principal = isLastInstallment
      ? roundToCents(remainingPrincipal)
      : monthlyPrincipalAmount;
    const interest = roundToCents(remainingPrincipal * monthlyInterestRate);
    const kkdf = roundToCents(interest * kkdfRate);
    const bsmv = roundToCents(interest * bsmvRate);
    const installment = roundToCents(principal + interest + kkdf + bsmv);

    remainingPrincipal = roundToCents(remainingPrincipal - principal);

    if (isLastInstallment || Math.abs(remainingPrincipal) < 0.01) {
      remainingPrincipal = 0;
    }

    return {
      installmentNumber,
      date: addMonths(input.firstInstallmentDate, index),
      installment,
      principal,
      interest,
      kkdf,
      bsmv,
      remainingPrincipal,
    };
  });
};

const buildCustomPaymentScheduleWithAmount = (
  input: LoanInput,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number,
  customPaymentMap: CustomPaymentMap,
  automaticInstallmentAmount: number,
  brokenPeriod: BrokenPeriodInfo,
  shouldAdjustFinalAutomaticInstallment: boolean
): PaymentScheduleItem[] => {
  let remainingPrincipal = input.principal;

  return Array.from({ length: input.term }, (_, index) => {
    const installmentNumber = index + 1;
    const customPaymentAmount = customPaymentMap.get(installmentNumber);
    const isCustomPayment = customPaymentAmount !== undefined;
    const isLastInstallment = installmentNumber === input.term;
    let interest = roundToCents(
      remainingPrincipal * monthlyInterestRate +
        (installmentNumber === 1 ? brokenPeriod.interestDiff : 0)
    );
    let kkdf = roundToCents(interest * kkdfRate);
    let bsmv = roundToCents(interest * bsmvRate);
    let carryingCost = roundToCents(interest + kkdf + bsmv);
    const isAdjustedFinalAutomatic =
      shouldAdjustFinalAutomaticInstallment && isLastInstallment && !isCustomPayment;
    const installment = isAdjustedFinalAutomatic
      ? roundToCents(remainingPrincipal + carryingCost)
      : isCustomPayment
        ? customPaymentAmount
        : automaticInstallmentAmount;

    if (installment <= carryingCost) {
      throw new Error(
        isCustomPayment
          ? 'Özel taksit tutarı, ilgili dönemin faiz ve vergi tutarını karşılamalıdır.'
          : 'Otomatik taksit tutarı ilgili dönemin faiz ve vergi tutarını karşılayamıyor.'
      );
    }

    let principal = isAdjustedFinalAutomatic
      ? roundToCents(remainingPrincipal)
      : roundToCents(installment - carryingCost);

    if (principal > remainingPrincipal + 0.01) {
      const overpaymentAmount = roundToCents(principal - remainingPrincipal);

      if (isLastInstallment && isCustomPayment && overpaymentAmount <= 0.1) {
        principal = roundToCents(remainingPrincipal);
        carryingCost = roundToCents(installment - principal);
        interest = roundToCents(carryingCost / (1 + kkdfRate + bsmvRate));
        kkdf = roundToCents(interest * kkdfRate);
        bsmv = roundToCents(installment - principal - interest - kkdf);
      } else {
        throw new Error('Özel ödeme kalan anaparayı negatife düşüremez.');
      }
    }

    remainingPrincipal = roundToCents(remainingPrincipal - principal);

    if (Math.abs(remainingPrincipal) < 0.01) {
      remainingPrincipal = 0;
    }

    return {
      installmentNumber,
      date: addMonths(input.firstInstallmentDate, index),
      installment,
      principal,
      interest,
      kkdf,
      bsmv,
      remainingPrincipal,
    };
  });
};

const simulateCustomPaymentFinalRemaining = (
  input: LoanInput,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number,
  customPaymentMap: CustomPaymentMap,
  automaticInstallmentAmount: number,
  brokenPeriod: BrokenPeriodInfo
): number => {
  let remainingPrincipal = input.principal;

  for (let index = 0; index < input.term; index += 1) {
    const installmentNumber = index + 1;
    const customPaymentAmount = customPaymentMap.get(installmentNumber);
    const isCustomPayment = customPaymentAmount !== undefined;
    const interest = roundToCents(
      remainingPrincipal * monthlyInterestRate +
        (installmentNumber === 1 ? brokenPeriod.interestDiff : 0)
    );
    const kkdf = roundToCents(interest * kkdfRate);
    const bsmv = roundToCents(interest * bsmvRate);
    const carryingCost = roundToCents(interest + kkdf + bsmv);
    const installment = isCustomPayment
      ? customPaymentAmount
      : automaticInstallmentAmount;

    if (installment <= carryingCost) {
      if (isCustomPayment) {
        throw new Error(
          'Özel taksit tutarı, ilgili dönemin faiz ve vergi tutarını karşılamalıdır.'
        );
      }

      return Number.POSITIVE_INFINITY;
    }

    const principal = roundToCents(installment - carryingCost);

    if (principal > remainingPrincipal + 0.01) {
      return Number.NEGATIVE_INFINITY;
    }

    remainingPrincipal = roundToCents(remainingPrincipal - principal);
  }

  return remainingPrincipal;
};

const solveAutomaticCustomPaymentInstallment = (
  input: LoanInput,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number,
  customPaymentMap: CustomPaymentMap,
  brokenPeriod: BrokenPeriodInfo,
  baseInstallment: number
): number => {
  const automaticInstallmentCount = input.term - customPaymentMap.size;

  if (automaticInstallmentCount <= 0) {
    const schedule = buildCustomPaymentScheduleWithAmount(
      input,
      monthlyInterestRate,
      kkdfRate,
      bsmvRate,
      customPaymentMap,
      0,
      brokenPeriod,
      false
    );
    const finalRemaining =
      schedule[schedule.length - 1]?.remainingPrincipal ?? input.principal;

    if (Math.abs(finalRemaining) > 0.01) {
      throw new Error(
        'Tüm taksitler özel girilmişse ödeme planı vade sonunda anaparayı kapatmalıdır.'
      );
    }

    return 0;
  }

  let low = 0.01;
  let high = Math.max(baseInstallment, 0.01);
  let highRemaining = simulateCustomPaymentFinalRemaining(
    input,
    monthlyInterestRate,
    kkdfRate,
    bsmvRate,
    customPaymentMap,
    high,
    brokenPeriod
  );
  let guard = 0;

  while (highRemaining > 0 && guard < 60) {
    high *= 2;
    highRemaining = simulateCustomPaymentFinalRemaining(
      input,
      monthlyInterestRate,
      kkdfRate,
      bsmvRate,
      customPaymentMap,
      high,
      brokenPeriod
    );
    guard += 1;
  }

  if (highRemaining > 0) {
    throw new Error('Özel ödeme planı için otomatik taksit çözülemedi.');
  }

  for (let iteration = 0; iteration < CUSTOM_PAYMENT_MAX_ITERATIONS; iteration += 1) {
    const middle = (low + high) / 2;
    const finalRemaining = simulateCustomPaymentFinalRemaining(
      input,
      monthlyInterestRate,
      kkdfRate,
      bsmvRate,
      customPaymentMap,
      middle,
      brokenPeriod
    );

    if (finalRemaining > 0) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return roundToCents(high);
};

const calculateBrokenPeriod = (
  input: LoanInput,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number
): BrokenPeriodInfo => {
  const standardFirstInstallmentDate = addMonths(input.creditUsageDate, 1);
  const diffDays = daysBetween(
    standardFirstInstallmentDate,
    input.firstInstallmentDate
  );
  const dailyInterestRate = monthlyInterestRate / 30;
  const interestDiff = roundToCents(input.principal * dailyInterestRate * diffDays);
  const kkdfDiff = roundToCents(interestDiff * kkdfRate);
  const bsmvDiff = roundToCents(interestDiff * bsmvRate);

  return {
    standardFirstInstallmentDate,
    actualFirstInstallmentDate: input.firstInstallmentDate,
    diffDays,
    interestDiff,
    kkdfDiff,
    bsmvDiff,
    totalDiff: roundToCents(interestDiff + kkdfDiff + bsmvDiff),
  };
};

export const calculateLoan = (input: LoanInput): LoanCalculationResult => {
  const planType: LoanPlanType = input.planType ?? 'standard';

  if (input.principal <= 0) {
    throw new Error('Kredi tutarı pozitif olmalıdır.');
  }

  if (!Number.isInteger(input.term) || input.term <= 0) {
    throw new Error('Vade pozitif tam sayı olmalıdır.');
  }

  if (
    input.monthlyInterestRatePercent < 0 ||
    input.kkdfRatePercent < 0 ||
    input.bsmvRatePercent < 0
  ) {
    throw new Error('Oranlar negatif olamaz.');
  }

  if (input.firstInstallmentDate < input.creditUsageDate) {
    throw new Error('İlk taksit tarihi kredi kullanım tarihinden önce olamaz.');
  }

  if (planType === 'prepaidInterest') {
    if (
      input.prepaidInterestAmount === undefined ||
      input.prepaidInterestAmount <= 0
    ) {
      throw new Error('Peşin faiz tutarı pozitif olmalıdır.');
    }
  }

  const monthlyInterestRate = input.monthlyInterestRatePercent / 100;
  const kkdfRate = input.kkdfRatePercent / 100;
  const bsmvRate = input.bsmvRatePercent / 100;
  const effectiveBaseRate = monthlyInterestRate * (1 + kkdfRate + bsmvRate);
  const baseInstallment = calculateStandardInstallment(
    input.principal,
    input.term,
    monthlyInterestRate,
    kkdfRate,
    bsmvRate
  );
  const annuityFactor = calculateAnnuityFactor(input.term, effectiveBaseRate);
  let effectiveMonthlyInterestRate = monthlyInterestRate;
  let prepaidInterestInput: number | undefined;
  let realizedPrepaidInterest: number | undefined;
  let discountedMonthlyRate: number | undefined;
  let monthlyPrincipalAmount: number | undefined;
  let automaticInstallmentAmount: number | undefined;
  const customPaymentMap =
    planType === 'customPayment' ? normalizeCustomPayments(input) : undefined;

  if (planType === 'prepaidInterest') {
    prepaidInterestInput = input.prepaidInterestAmount ?? 0;
    const zeroRateInstallment = calculateStandardInstallment(
      input.principal,
      input.term,
      0,
      kkdfRate,
      bsmvRate
    );
    const maximumPrepaidInterest = roundToCents(
      (baseInstallment - zeroRateInstallment) * annuityFactor
    );

    if (prepaidInterestInput > maximumPrepaidInterest + 0.01) {
      throw new Error(
        `Bu kredi için girilebilecek azami peşin faiz tutarı yaklaşık ${formatApproximateCurrency(
          maximumPrepaidInterest
        )} TL'dir. Daha yüksek tutarda indirimli faiz oranı 0'ın altına düşeceği için ödeme planı oluşturulamaz.`
      );
    }

    if (prepaidInterestInput >= input.principal) {
      throw new Error('Peşin faiz tutarı kredi tutarından küçük olmalıdır.');
    }

    const targetInstallment =
      baseInstallment - prepaidInterestInput / annuityFactor;

    if (!Number.isFinite(targetInstallment) || targetInstallment <= 0) {
      throw new Error('Peşin faiz tutarı için hedef taksit geçersiz.');
    }

    const solvedMonthlyRate = solveMonthlyRateForInstallment(
      input.principal,
      input.term,
      targetInstallment,
      kkdfRate,
      bsmvRate,
      monthlyInterestRate
    );
    effectiveMonthlyInterestRate =
      roundRateUpToDisplayPrecision(solvedMonthlyRate);

    if (effectiveMonthlyInterestRate < 0) {
      throw new Error('İndirimli faiz oranı negatif olamaz.');
    }

    discountedMonthlyRate = effectiveMonthlyInterestRate;
  }

  const standardInstallment = calculateStandardInstallment(
    input.principal,
    input.term,
    effectiveMonthlyInterestRate,
    kkdfRate,
    bsmvRate
  );
  if (planType === 'equalPrincipal') {
    monthlyPrincipalAmount = roundToCents(input.principal / input.term);
  }

  const brokenPeriod = calculateBrokenPeriod(
    input,
    effectiveMonthlyInterestRate,
    kkdfRate,
    bsmvRate
  );

  if (planType === 'customPayment' && customPaymentMap) {
    automaticInstallmentAmount = solveAutomaticCustomPaymentInstallment(
      input,
      effectiveMonthlyInterestRate,
      kkdfRate,
      bsmvRate,
      customPaymentMap,
      brokenPeriod,
      standardInstallment
    );
  }

  const baseSchedule =
    planType === 'customPayment' && customPaymentMap
      ? buildCustomPaymentScheduleWithAmount(
          input,
          effectiveMonthlyInterestRate,
          kkdfRate,
          bsmvRate,
          customPaymentMap,
          automaticInstallmentAmount ?? 0,
          brokenPeriod,
          true
        )
      : planType === 'equalPrincipal'
        ? buildEqualPrincipalSchedule(
            input,
            effectiveMonthlyInterestRate,
            kkdfRate,
            bsmvRate
          )
        : buildStandardSchedule(
            input,
            standardInstallment,
            effectiveMonthlyInterestRate,
            kkdfRate,
            bsmvRate
          );
  let schedule = baseSchedule.map((item) => {
    if (
      planType === 'customPayment' ||
      item.installmentNumber !== 1 ||
      brokenPeriod.diffDays === 0
    ) {
      return item;
    }

    const interest = roundToCents(item.interest + brokenPeriod.interestDiff);
    const kkdf = roundToCents(item.kkdf + brokenPeriod.kkdfDiff);
    const bsmv = roundToCents(item.bsmv + brokenPeriod.bsmvDiff);

    return {
      ...item,
      interest,
      kkdf,
      bsmv,
      installment: roundToCents(item.principal + interest + kkdf + bsmv),
    };
  });

  if (planType === 'prepaidInterest') {
    realizedPrepaidInterest = roundToCents(
      (baseInstallment - standardInstallment) * annuityFactor
    );
    const upfrontKkdf = roundToCents(realizedPrepaidInterest * kkdfRate);
    const upfrontBsmv = roundToCents(realizedPrepaidInterest * bsmvRate);
    const upfrontInstallment = roundToCents(
      realizedPrepaidInterest + upfrontKkdf + upfrontBsmv
    );

    if (realizedPrepaidInterest <= 0) {
      throw new Error('Peşin faiz tutarı için indirimli taksit hesaplanamadı.');
    }

    schedule = [
      {
        installmentNumber: 0,
        date: input.creditUsageDate,
        installment: upfrontInstallment,
        principal: 0,
        interest: realizedPrepaidInterest,
        kkdf: upfrontKkdf,
        bsmv: upfrontBsmv,
        remainingPrincipal: input.principal,
        isPrepaidInterest: true,
      },
      ...schedule,
    ];
  }

  if (planType === 'customPayment') {
    const finalRemainingPrincipal =
      schedule[schedule.length - 1]?.remainingPrincipal ?? input.principal;

    if (Math.abs(finalRemainingPrincipal) > 0.01) {
      throw new Error('Özel ödeme planı vade sonunda kalan anaparayı kapatmalıdır.');
    }
  }

  const totals = schedule.reduce(
    (accumulator, item) => ({
      totalPayment: roundToCents(accumulator.totalPayment + item.installment),
      totalPrincipal: roundToCents(accumulator.totalPrincipal + item.principal),
      totalInterest: roundToCents(accumulator.totalInterest + item.interest),
      totalKkdf: roundToCents(accumulator.totalKkdf + item.kkdf),
      totalBsmv: roundToCents(accumulator.totalBsmv + item.bsmv),
    }),
    {
      totalPayment: 0,
      totalPrincipal: 0,
      totalInterest: 0,
      totalKkdf: 0,
      totalBsmv: 0,
    }
  );

  return {
    input,
    planType,
    standardInstallment,
    firstInstallment:
      planType === 'prepaidInterest'
        ? schedule.find((item) => item.installmentNumber === 1)?.installment ?? 0
        : schedule[0]?.installment ?? 0,
    schedule,
    brokenPeriod,
    discountedMonthlyRate,
    prepaidInterestInput,
    realizedPrepaidInterest,
    monthlyPrincipalAmount,
    firstInstallmentAmount:
      planType === 'prepaidInterest'
        ? schedule.find((item) => item.installmentNumber === 1)?.installment
        : schedule[0]?.installment,
    lastInstallmentAmount: schedule[schedule.length - 1]?.installment,
    automaticInstallmentAmount,
    infoMessages: [],
    warnings: [],
    ...totals,
  };
};
