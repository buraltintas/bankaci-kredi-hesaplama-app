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
const INCREASING_INSTALLMENT_MAX_ITERATIONS = 100;
const NORMAL_FIRST_INSTALLMENT_GRACE_DAYS = 3;

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

const formatApproximatePercent = (value: number): string =>
  value.toLocaleString('tr-TR', {
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
    let principal = isLastInstallment
      ? roundToCents(remainingPrincipal)
      : calculatedPrincipal;

    if (principal > remainingPrincipal) {
      principal = roundToCents(remainingPrincipal);
    }

    if (principal < 0 && Math.abs(principal) <= 0.01) {
      principal = 0;
    }

    const installment =
      isLastInstallment || principal !== calculatedPrincipal
        ? roundToCents(principal + interest + kkdf + bsmv)
        : standardInstallment;

    remainingPrincipal = roundToCents(remainingPrincipal - principal);

    if (isLastInstallment || Math.abs(remainingPrincipal) <= 0.01) {
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
    let principal = isLastInstallment
      ? roundToCents(remainingPrincipal)
      : monthlyPrincipalAmount;

    if (principal > remainingPrincipal) {
      principal = roundToCents(remainingPrincipal);
    }

    if (principal < 0 && Math.abs(principal) <= 0.01) {
      principal = 0;
    }

    const interest = roundToCents(remainingPrincipal * monthlyInterestRate);
    const kkdf = roundToCents(interest * kkdfRate);
    const bsmv = roundToCents(interest * bsmvRate);
    const installment = roundToCents(principal + interest + kkdf + bsmv);

    remainingPrincipal = roundToCents(remainingPrincipal - principal);

    if (isLastInstallment || Math.abs(remainingPrincipal) <= 0.01) {
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

const buildInterestOnlySchedule = (
  input: LoanInput,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number,
  brokenPeriod: BrokenPeriodInfo,
  effectiveInstallmentCount: number,
  interestOnlyInstallmentCount: number,
  postInterestOnlyInstallmentAmount: number
): PaymentScheduleItem[] => {
  let remainingPrincipal = input.principal;

  return Array.from({ length: effectiveInstallmentCount }, (_, index) => {
    const installmentNumber = index + 1;
    const isInterestOnly =
      installmentNumber <= interestOnlyInstallmentCount;
    const isLastInstallment = installmentNumber === effectiveInstallmentCount;
    const interest = roundToCents(
      remainingPrincipal * monthlyInterestRate +
        (installmentNumber === 1 ? brokenPeriod.interestDiff : 0)
    );
    const kkdf = roundToCents(interest * kkdfRate);
    const bsmv = roundToCents(interest * bsmvRate);

    if (isInterestOnly) {
      return {
        installmentNumber,
        date: addMonths(input.firstInstallmentDate, index),
        installment: roundToCents(interest + kkdf + bsmv),
        principal: 0,
        interest,
        kkdf,
        bsmv,
        remainingPrincipal,
        isInterestOnly: true,
      };
    }

    const calculatedPrincipal = roundToCents(
      postInterestOnlyInstallmentAmount - interest - kkdf - bsmv
    );
    const principal = isLastInstallment
      ? roundToCents(remainingPrincipal)
      : calculatedPrincipal;
    const installment = isLastInstallment
      ? roundToCents(principal + interest + kkdf + bsmv)
      : postInterestOnlyInstallmentAmount;

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
      isInterestOnly: false,
    };
  });
};

const isValidDate = (date: Date): boolean =>
  date instanceof Date && !Number.isNaN(date.getTime());

const calculateFullMonthDelay = (
  creditUsageDate: Date,
  firstInstallmentDate: Date
): number => {
  let monthDifference =
    (firstInstallmentDate.getFullYear() - creditUsageDate.getFullYear()) * 12 +
    (firstInstallmentDate.getMonth() - creditUsageDate.getMonth());

  if (monthDifference < 0) {
    return monthDifference;
  }

  while (
    monthDifference > 0 &&
    addMonths(creditUsageDate, monthDifference).getTime() >
      firstInstallmentDate.getTime()
  ) {
    monthDifference -= 1;
  }

  while (
    addMonths(creditUsageDate, monthDifference + 1).getTime() <=
    firstInstallmentDate.getTime()
  ) {
    monthDifference += 1;
  }

  return monthDifference;
};

const addDays = (date: Date, days: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const isNormalFirstInstallmentStart = (
  creditUsageDate: Date,
  firstInstallmentDate: Date
): boolean => {
  const normalFirstInstallmentLatestDate = addDays(
    addMonths(creditUsageDate, 1),
    NORMAL_FIRST_INSTALLMENT_GRACE_DAYS
  );

  return firstInstallmentDate.getTime() <= normalFirstInstallmentLatestDate.getTime();
};

const buildFirstInstallmentDelayInfo = (
  originalTerm: number,
  deductedDelayMonths: number,
  effectiveInstallmentCount: number
): string =>
  `Girilen vade: ${originalTerm} ay
İlk taksit ertelemesi: ${deductedDelayMonths} ay
Ödeme planı taksit sayısı: ${effectiveInstallmentCount}`;

const calculateInterestOnlyEffectiveInstallmentCount = (
  input: LoanInput
): number => {
  if (
    !isValidDate(input.creditUsageDate) ||
    !isValidDate(input.firstInstallmentDate)
  ) {
    return input.term;
  }

  const maturityEndDate = addMonths(input.creditUsageDate, input.term);
  let effectiveInstallmentCount = 0;

  for (let index = 0; index < input.term; index += 1) {
    const installmentDate = addMonths(input.firstInstallmentDate, index);

    if (installmentDate.getTime() > maturityEndDate.getTime()) {
      break;
    }

    effectiveInstallmentCount += 1;
  }

  return effectiveInstallmentCount;
};

const getIncreasingInstallmentPeriodIndex = (
  installmentNumber: number,
  frequencyMonths: number,
  startNo: number,
  endNo: number
): number => {
  if (installmentNumber < startNo) {
    return 0;
  }

  const cappedInstallmentNumber = Math.min(installmentNumber, endNo);

  return Math.floor((cappedInstallmentNumber - startNo) / frequencyMonths);
};

const calculateIncreasingInstallmentAmount = (
  baseInstallmentAmount: number,
  increaseRate: number,
  installmentNumber: number,
  frequencyMonths: number,
  startNo: number,
  endNo: number
): number =>
  roundToCents(
    baseInstallmentAmount *
      Math.pow(
        1 + increaseRate,
        getIncreasingInstallmentPeriodIndex(
          installmentNumber,
          frequencyMonths,
          startNo,
          endNo
        )
      )
  );

const simulateIncreasingInstallmentFinalRemaining = (
  input: LoanInput,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number,
  brokenPeriod: BrokenPeriodInfo,
  increaseRate: number,
  frequencyMonths: number,
  startNo: number,
  endNo: number,
  baseInstallmentAmount: number
): number => {
  let remainingPrincipal = input.principal;

  for (let index = 0; index < input.term; index += 1) {
    const installmentNumber = index + 1;
    const isLastInstallment = installmentNumber === input.term;
    const installment = calculateIncreasingInstallmentAmount(
      baseInstallmentAmount,
      increaseRate,
      installmentNumber,
      frequencyMonths,
      startNo,
      endNo
    );
    const interest = roundToCents(
      remainingPrincipal * monthlyInterestRate +
        (installmentNumber === 1 ? brokenPeriod.interestDiff : 0)
    );
    const kkdf = roundToCents(interest * kkdfRate);
    const bsmv = roundToCents(interest * bsmvRate);
    const carryingCost = roundToCents(interest + kkdf + bsmv);

    if (installment <= carryingCost) {
      return Number.POSITIVE_INFINITY;
    }

    const principal = roundToCents(installment - carryingCost);

    if (principal <= 0) {
      return Number.POSITIVE_INFINITY;
    }

    if (principal > remainingPrincipal + 0.01) {
      if (isLastInstallment) {
        return 0;
      }

      return Number.NEGATIVE_INFINITY;
    }

    remainingPrincipal = roundToCents(remainingPrincipal - principal);

    if (Math.abs(remainingPrincipal) < 0.01) {
      remainingPrincipal = 0;
    }
  }

  return remainingPrincipal;
};

type IncreasingInstallmentSolveResult =
  | { status: 'valid'; baseInstallmentAmount: number }
  | { status: 'earlyClose' | 'carryingCost' | 'unsolved' };

const resolveIncreasingBaseInstallment = (
  input: LoanInput,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number,
  brokenPeriod: BrokenPeriodInfo,
  increaseRate: number,
  frequencyMonths: number,
  startNo: number,
  endNo: number,
  standardInstallment: number
): IncreasingInstallmentSolveResult => {
  let low = 0.01;
  let high = Math.max(standardInstallment, 0.01);
  let highRemaining = simulateIncreasingInstallmentFinalRemaining(
    input,
    monthlyInterestRate,
    kkdfRate,
    bsmvRate,
    brokenPeriod,
    increaseRate,
    frequencyMonths,
    startNo,
    endNo,
    high
  );
  let guard = 0;

  while (
    (highRemaining > 0 || highRemaining === Number.POSITIVE_INFINITY) &&
    guard < 80
  ) {
    high *= 2;
    highRemaining = simulateIncreasingInstallmentFinalRemaining(
      input,
      monthlyInterestRate,
      kkdfRate,
      bsmvRate,
      brokenPeriod,
      increaseRate,
      frequencyMonths,
      startNo,
      endNo,
      high
    );
    guard += 1;
  }

  if (highRemaining > 0 || highRemaining === Number.POSITIVE_INFINITY) {
    return { status: 'unsolved' };
  }

  for (
    let iteration = 0;
    iteration < INCREASING_INSTALLMENT_MAX_ITERATIONS;
    iteration += 1
  ) {
    const middle = (low + high) / 2;
    const finalRemaining = simulateIncreasingInstallmentFinalRemaining(
      input,
      monthlyInterestRate,
      kkdfRate,
      bsmvRate,
      brokenPeriod,
      increaseRate,
      frequencyMonths,
      startNo,
      endNo,
      middle
    );

    if (finalRemaining > 0 || finalRemaining === Number.POSITIVE_INFINITY) {
      low = middle;
    } else {
      high = middle;
    }
  }

  const candidateInstallment = roundToCents(high);
  const candidateRemaining = simulateIncreasingInstallmentFinalRemaining(
    input,
    monthlyInterestRate,
    kkdfRate,
    bsmvRate,
    brokenPeriod,
    increaseRate,
    frequencyMonths,
    startNo,
    endNo,
    candidateInstallment
  );

  if (candidateRemaining === Number.NEGATIVE_INFINITY) {
    return { status: 'earlyClose' };
  }

  if (candidateRemaining === Number.POSITIVE_INFINITY) {
    return { status: 'carryingCost' };
  }

  return { status: 'valid', baseInstallmentAmount: candidateInstallment };
};

const calculateMaximumIncreasingRatePercent = (
  input: LoanInput,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number,
  brokenPeriod: BrokenPeriodInfo,
  frequencyMonths: number,
  startNo: number,
  endNo: number,
  standardInstallment: number
): number | null => {
  const isValidRate = (increaseRatePercent: number): boolean =>
    resolveIncreasingBaseInstallment(
      input,
      monthlyInterestRate,
      kkdfRate,
      bsmvRate,
      brokenPeriod,
      increaseRatePercent / 100,
      frequencyMonths,
      startNo,
      endNo,
      standardInstallment
    ).status === 'valid';

  let low = 0.0001;

  if (!isValidRate(low)) {
    return null;
  }

  let high = 1;

  while (isValidRate(high) && high < 1000) {
    low = high;
    high *= 2;
  }

  if (high >= 1000 && isValidRate(high)) {
    return null;
  }

  for (let iteration = 0; iteration < 28; iteration += 1) {
    const middle = (low + high) / 2;

    if (isValidRate(middle)) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return Math.floor(low * 100) / 100;
};

const buildIncreasingRateRangeText = (
  maximumRatePercent: number | null
): string => {
  if (maximumRatePercent === null) {
    return 'Uygulanabilir artış oranı aralığı bu kredi için hesaplanamadı.';
  }

  return `Bu kredi için uygulanabilir taksit artış oranı en fazla yaklaşık %${formatApproximatePercent(
    maximumRatePercent
  )} olmalıdır.`;
};

const solveIncreasingBaseInstallment = (
  input: LoanInput,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number,
  brokenPeriod: BrokenPeriodInfo,
  increaseRate: number,
  frequencyMonths: number,
  startNo: number,
  endNo: number,
  standardInstallment: number
): number => {
  const result = resolveIncreasingBaseInstallment(
    input,
    monthlyInterestRate,
    kkdfRate,
    bsmvRate,
    brokenPeriod,
    increaseRate,
    frequencyMonths,
    startNo,
    endNo,
    standardInstallment
  );

  if (result.status === 'valid') {
    return result.baseInstallmentAmount;
  }

  const rateRangeText = buildIncreasingRateRangeText(
    calculateMaximumIncreasingRatePercent(
      input,
      monthlyInterestRate,
        kkdfRate,
        bsmvRate,
        brokenPeriod,
        frequencyMonths,
        startNo,
        endNo,
        standardInstallment
      )
  );

  if (result.status === 'earlyClose') {
    throw new Error(
      `Artan taksit oranı bu vade/faiz yapısında krediyi vade bitmeden kapatıyor. ${rateRangeText} Daha düşük artış oranı veya daha kısa vade deneyin.`
    );
  }

  if (result.status === 'carryingCost') {
    throw new Error(
      `Artan taksit oranı bu vade/faiz yapısında ilk dönem faizini karşılayamıyor. ${rateRangeText}`
    );
  }

  throw new Error(
    `Artan taksitli plan için başlangıç taksiti çözülemedi. ${rateRangeText}`
  );
};

const buildIncreasingInstallmentSchedule = (
  input: LoanInput,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number,
  brokenPeriod: BrokenPeriodInfo,
  increaseRate: number,
  frequencyMonths: number,
  startNo: number,
  endNo: number,
  baseInstallmentAmount: number
): PaymentScheduleItem[] => {
  let remainingPrincipal = input.principal;

  return Array.from({ length: input.term }, (_, index) => {
    const installmentNumber = index + 1;
    const isLastInstallment = installmentNumber === input.term;
    const scheduledInstallment = calculateIncreasingInstallmentAmount(
      baseInstallmentAmount,
      increaseRate,
      installmentNumber,
      frequencyMonths,
      startNo,
      endNo
    );
    const interest = roundToCents(
      remainingPrincipal * monthlyInterestRate +
        (installmentNumber === 1 ? brokenPeriod.interestDiff : 0)
    );
    const kkdf = roundToCents(interest * kkdfRate);
    const bsmv = roundToCents(interest * bsmvRate);
    const carryingCost = roundToCents(interest + kkdf + bsmv);

    if (scheduledInstallment <= carryingCost) {
      throw new Error(
        'Artan taksit, ilgili dönemin faiz ve vergi tutarını karşılamalıdır.'
      );
    }

    const calculatedPrincipal = roundToCents(scheduledInstallment - carryingCost);

    if (calculatedPrincipal <= 0) {
      throw new Error('Artan taksitli planda her taksit anapara ödemelidir.');
    }

    if (!isLastInstallment && calculatedPrincipal > remainingPrincipal + 0.01) {
      throw new Error('Artan taksitli plan kalan anaparayı negatife düşüremez.');
    }

    const principal = isLastInstallment
      ? roundToCents(remainingPrincipal)
      : calculatedPrincipal;
    const installment = isLastInstallment
      ? roundToCents(principal + carryingCost)
      : scheduledInstallment;

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
      isIncreasingInstallment: true,
    };
  });
};

const calculateCarryingCost = (
  remainingPrincipal: number,
  installmentNumber: number,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number,
  brokenPeriod: BrokenPeriodInfo
) => {
  const interest = roundToCents(
    remainingPrincipal * monthlyInterestRate +
      (installmentNumber === 1 ? brokenPeriod.interestDiff : 0)
  );
  const kkdf = roundToCents(interest * kkdfRate);
  const bsmv = roundToCents(interest * bsmvRate);
  const carryingCost = roundToCents(interest + kkdf + bsmv);

  return { interest, kkdf, bsmv, carryingCost };
};

const calculateRemainingAfterCustomPayment = (
  remainingPrincipal: number,
  installmentNumber: number,
  customPaymentAmount: number,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number,
  brokenPeriod: BrokenPeriodInfo
): number => {
  const { carryingCost } = calculateCarryingCost(
    remainingPrincipal,
    installmentNumber,
    monthlyInterestRate,
    kkdfRate,
    bsmvRate,
    brokenPeriod
  );

  return roundToCents(remainingPrincipal + carryingCost - customPaymentAmount);
};

const buildCustomPaymentItem = (
  input: LoanInput,
  remainingPrincipal: number,
  installmentNumber: number,
  customPaymentAmount: number,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number,
  brokenPeriod: BrokenPeriodInfo
): PaymentScheduleItem => {
  let { interest, kkdf, bsmv, carryingCost } = calculateCarryingCost(
    remainingPrincipal,
    installmentNumber,
    monthlyInterestRate,
    kkdfRate,
    bsmvRate,
    brokenPeriod
  );

  if (customPaymentAmount < carryingCost) {
    throw new Error(
      'Özel taksit tutarı, ilgili dönemin faiz ve vergi tutarını karşılamalıdır.'
    );
  }

  let principal = roundToCents(customPaymentAmount - carryingCost);

  if (Math.abs(principal) < 0.01) {
    principal = 0;
  }

  if (principal > remainingPrincipal + 0.01) {
    const overpaymentAmount = roundToCents(principal - remainingPrincipal);

    if (installmentNumber === input.term && overpaymentAmount <= 0.1) {
      principal = roundToCents(remainingPrincipal);
      carryingCost = roundToCents(customPaymentAmount - principal);
      interest = roundToCents(carryingCost / (1 + kkdfRate + bsmvRate));
      kkdf = roundToCents(interest * kkdfRate);
      bsmv = roundToCents(customPaymentAmount - principal - interest - kkdf);
    } else {
      throw new Error('Özel ödeme kalan anaparayı negatife düşüremez.');
    }
  }

  const finalPrincipalShortfall = roundToCents(remainingPrincipal - principal);

  if (
    installmentNumber === input.term &&
    finalPrincipalShortfall > 0 &&
    finalPrincipalShortfall <= 0.01
  ) {
    principal = roundToCents(remainingPrincipal);
    carryingCost = roundToCents(customPaymentAmount - principal);
    interest = roundToCents(carryingCost / (1 + kkdfRate + bsmvRate));
    kkdf = roundToCents(interest * kkdfRate);
    bsmv = roundToCents(customPaymentAmount - principal - interest - kkdf);
  }

  principal = Math.min(principal, remainingPrincipal);

  let nextRemainingPrincipal = roundToCents(remainingPrincipal - principal);

  if (Math.abs(nextRemainingPrincipal) <= 0.01) {
    nextRemainingPrincipal = 0;
  }

  return {
    installmentNumber,
    date: addMonths(input.firstInstallmentDate, installmentNumber - 1),
    installment: customPaymentAmount,
    principal,
    interest,
    kkdf,
    bsmv,
    remainingPrincipal: nextRemainingPrincipal,
    isCustomPayment: true,
  };
};

const simulateAutomaticSegmentRemaining = (
  startRemainingPrincipal: number,
  startInstallmentNumber: number,
  segmentLength: number,
  automaticInstallmentAmount: number,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number,
  brokenPeriod: BrokenPeriodInfo
): number => {
  let remainingPrincipal = startRemainingPrincipal;

  for (let offset = 0; offset < segmentLength; offset += 1) {
    const installmentNumber = startInstallmentNumber + offset;
    const { carryingCost } = calculateCarryingCost(
      remainingPrincipal,
      installmentNumber,
      monthlyInterestRate,
      kkdfRate,
      bsmvRate,
      brokenPeriod
    );

    if (automaticInstallmentAmount < carryingCost) {
      return Number.POSITIVE_INFINITY;
    }

    let principal = roundToCents(automaticInstallmentAmount - carryingCost);

    if (Math.abs(principal) < 0.01) {
      principal = 0;
    }

    if (principal > remainingPrincipal + 0.01) {
      return Number.NEGATIVE_INFINITY;
    }

    remainingPrincipal = roundToCents(remainingPrincipal - principal);

    if (Math.abs(remainingPrincipal) < 0.01) {
      remainingPrincipal = 0;
    }
  }

  return remainingPrincipal;
};

const solveAutomaticSegmentInstallment = (
  startRemainingPrincipal: number,
  startInstallmentNumber: number,
  segmentLength: number,
  targetRemainingPrincipal: number,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number,
  brokenPeriod: BrokenPeriodInfo
): number => {
  if (segmentLength <= 0) {
    return 0;
  }

  let low = 0;
  let high = Math.max(
    calculateStandardInstallment(
      startRemainingPrincipal,
      segmentLength,
      monthlyInterestRate,
      kkdfRate,
      bsmvRate
    ),
    0.01
  );
  let highRemaining = simulateAutomaticSegmentRemaining(
    startRemainingPrincipal,
    startInstallmentNumber,
    segmentLength,
    high,
    monthlyInterestRate,
    kkdfRate,
    bsmvRate,
    brokenPeriod
  );
  let guard = 0;

  while (highRemaining > targetRemainingPrincipal && guard < 60) {
    high *= 2;
    highRemaining = simulateAutomaticSegmentRemaining(
      startRemainingPrincipal,
      startInstallmentNumber,
      segmentLength,
      high,
      monthlyInterestRate,
      kkdfRate,
      bsmvRate,
      brokenPeriod
    );
    guard += 1;
  }

  if (highRemaining > targetRemainingPrincipal) {
    throw new Error('Özel ödeme planı için otomatik taksit çözülemedi.');
  }

  for (let iteration = 0; iteration < CUSTOM_PAYMENT_MAX_ITERATIONS; iteration += 1) {
    const middle = (low + high) / 2;
    const remaining = simulateAutomaticSegmentRemaining(
      startRemainingPrincipal,
      startInstallmentNumber,
      segmentLength,
      middle,
      monthlyInterestRate,
      kkdfRate,
      bsmvRate,
      brokenPeriod
    );

    if (remaining > targetRemainingPrincipal) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return roundToCents(high);
};

const solveRemainingBeforeFinalCustomPayment = (
  maxRemainingPrincipal: number,
  installmentNumber: number,
  customPaymentAmount: number,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number,
  brokenPeriod: BrokenPeriodInfo
): number => {
  const remainingAtMax = calculateRemainingAfterCustomPayment(
    maxRemainingPrincipal,
    installmentNumber,
    customPaymentAmount,
    monthlyInterestRate,
    kkdfRate,
    bsmvRate,
    brokenPeriod
  );

  if (remainingAtMax < -0.01) {
    throw new Error('Özel ödeme kalan anaparayı negatife düşüremez.');
  }

  let low = 0;
  let high = maxRemainingPrincipal;

  for (let iteration = 0; iteration < CUSTOM_PAYMENT_MAX_ITERATIONS; iteration += 1) {
    const middle = (low + high) / 2;
    const finalRemaining = calculateRemainingAfterCustomPayment(
      middle,
      installmentNumber,
      customPaymentAmount,
      monthlyInterestRate,
      kkdfRate,
      bsmvRate,
      brokenPeriod
    );

    if (finalRemaining > 0) {
      high = middle;
    } else {
      low = middle;
    }
  }

  return roundToCents((low + high) / 2);
};

const buildCustomPaymentSchedule = (
  input: LoanInput,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number,
  customPaymentMap: CustomPaymentMap,
  brokenPeriod: BrokenPeriodInfo
): { schedule: PaymentScheduleItem[]; automaticInstallmentAmount?: number } => {
  const customInstallmentNumbers = [...customPaymentMap.keys()].sort((a, b) => a - b);
  const schedule: PaymentScheduleItem[] = [];
  let remainingPrincipal = input.principal;
  let automaticInstallmentAmount: number | undefined;
  let currentSegment:
    | {
        endInstallmentNumber: number;
        amount: number;
        targetRemainingPrincipal?: number;
      }
    | undefined;

  for (let installmentNumber = 1; installmentNumber <= input.term; installmentNumber += 1) {
    const customPaymentAmount = customPaymentMap.get(installmentNumber);

    if (customPaymentAmount !== undefined) {
      const item = buildCustomPaymentItem(
        input,
        remainingPrincipal,
        installmentNumber,
        customPaymentAmount,
        monthlyInterestRate,
        kkdfRate,
        bsmvRate,
        brokenPeriod
      );

      schedule.push(item);
      remainingPrincipal = item.remainingPrincipal;
      currentSegment = undefined;
      continue;
    }

    if (!currentSegment || installmentNumber > currentSegment.endInstallmentNumber) {
      const nextCustomInstallmentNumber = customInstallmentNumbers.find(
        (customInstallmentNumber) => customInstallmentNumber > installmentNumber
      );
      const segmentEndInstallmentNumber =
        nextCustomInstallmentNumber !== undefined
          ? nextCustomInstallmentNumber - 1
          : input.term;
      const segmentLength =
        segmentEndInstallmentNumber - installmentNumber + 1;
      let segmentAmount: number;
      let targetRemainingPrincipal: number | undefined;

      if (nextCustomInstallmentNumber === input.term) {
        targetRemainingPrincipal = solveRemainingBeforeFinalCustomPayment(
          remainingPrincipal,
          nextCustomInstallmentNumber,
          customPaymentMap.get(nextCustomInstallmentNumber) ?? 0,
          monthlyInterestRate,
          kkdfRate,
          bsmvRate,
          brokenPeriod
        );
        segmentAmount = solveAutomaticSegmentInstallment(
          remainingPrincipal,
          installmentNumber,
          segmentLength,
          targetRemainingPrincipal,
          monthlyInterestRate,
          kkdfRate,
          bsmvRate,
          brokenPeriod
        );
      } else {
        segmentAmount = solveAutomaticSegmentInstallment(
          remainingPrincipal,
          installmentNumber,
          input.term - installmentNumber + 1,
          0,
          monthlyInterestRate,
          kkdfRate,
          bsmvRate,
          brokenPeriod
        );
      }

      currentSegment = {
        endInstallmentNumber: segmentEndInstallmentNumber,
        amount: segmentAmount,
        targetRemainingPrincipal,
      };

      if (automaticInstallmentAmount === undefined) {
        automaticInstallmentAmount = segmentAmount;
      }
    }

    const { interest, kkdf, bsmv, carryingCost } = calculateCarryingCost(
      remainingPrincipal,
      installmentNumber,
      monthlyInterestRate,
      kkdfRate,
      bsmvRate,
      brokenPeriod
    );
    const isLastAutomaticInSegment =
      installmentNumber === currentSegment.endInstallmentNumber;
    const targetRemainingPrincipal =
      isLastAutomaticInSegment && currentSegment.targetRemainingPrincipal !== undefined
        ? currentSegment.targetRemainingPrincipal
        : installmentNumber === input.term
          ? 0
          : undefined;
    let principal =
      targetRemainingPrincipal !== undefined
        ? roundToCents(remainingPrincipal - targetRemainingPrincipal)
        : roundToCents(currentSegment.amount - carryingCost);

    if (Math.abs(principal) < 0.01) {
      principal = 0;
    }

    if (principal < 0 || currentSegment.amount < carryingCost) {
      throw new Error(
        'Otomatik taksit tutarı ilgili dönemin faiz ve vergi tutarını karşılayamıyor.'
      );
    }

    if (principal > remainingPrincipal + 0.01) {
      throw new Error('Özel ödeme kalan anaparayı negatife düşüremez.');
    }

    principal = Math.min(principal, remainingPrincipal);

    const installment =
      targetRemainingPrincipal !== undefined
        ? roundToCents(principal + carryingCost)
        : currentSegment.amount;

    remainingPrincipal = roundToCents(remainingPrincipal - principal);

    if (Math.abs(remainingPrincipal) < 0.01) {
      remainingPrincipal = 0;
    }

    schedule.push({
      installmentNumber,
      date: addMonths(input.firstInstallmentDate, installmentNumber - 1),
      installment,
      principal,
      interest,
      kkdf,
      bsmv,
      remainingPrincipal,
      isCustomPayment: false,
    });
  }

  return { schedule, automaticInstallmentAmount };
};

const calculateBrokenPeriod = (
  input: LoanInput,
  monthlyInterestRate: number,
  kkdfRate: number,
  bsmvRate: number,
  standardFirstInstallmentDelayMonths = 1
): BrokenPeriodInfo => {
  const standardFirstInstallmentDate = addMonths(
    input.creditUsageDate,
    standardFirstInstallmentDelayMonths
  );
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
  const originalInput: LoanInput = {
    ...input,
    deductFirstInstallmentDelayFromTerm:
      input.deductFirstInstallmentDelayFromTerm,
  };
  const planType: LoanPlanType = input.planType ?? 'standard';

  if (
    !isValidDate(input.creditUsageDate) ||
    !isValidDate(input.firstInstallmentDate)
  ) {
    throw new Error('Kredi kullanım tarihi ve ilk taksit tarihi geçerli olmalıdır.');
  }

  if (input.principal <= 0) {
    throw new Error('Kredi tutarı pozitif olmalıdır.');
  }

  if (!Number.isInteger(input.term) || input.term <= 0) {
    throw new Error('Vade pozitif tam sayı olmalıdır.');
  }

  if (input.deductFirstInstallmentDelayFromTerm === undefined) {
    throw new Error(
      'İlk taksit ertelemesini vadeden düş seçimi açık veya kapalı olarak belirtilmelidir.'
    );
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

  const firstInstallmentDelayMonths = calculateFullMonthDelay(
    input.creditUsageDate,
    input.firstInstallmentDate
  );
  const isNormalFirstInstallmentStartDate = isNormalFirstInstallmentStart(
    input.creditUsageDate,
    input.firstInstallmentDate
  );
  const shouldDeductFirstInstallmentDelay =
    input.deductFirstInstallmentDelayFromTerm === true &&
    planType !== 'interestOnly';
  const deductedDelayMonths =
    shouldDeductFirstInstallmentDelay && !isNormalFirstInstallmentStartDate
      ? Math.max(0, firstInstallmentDelayMonths - 1)
      : 0;
  let effectiveInstallmentCount = input.term;
  let firstInstallmentDelayInfo: string | undefined;

  if (deductedDelayMonths > 0) {
    if (deductedDelayMonths >= input.term) {
      throw new Error(
        'İlk taksit ertelemesi vadeden büyük veya vadeye eşit olamaz.'
      );
    }

    effectiveInstallmentCount = input.term - deductedDelayMonths;

    if (effectiveInstallmentCount < 1) {
      throw new Error(
        'İlk taksit ertelemesi sonrası en az 1 taksit kalmalıdır.'
      );
    }

    firstInstallmentDelayInfo = buildFirstInstallmentDelayInfo(
      input.term,
      deductedDelayMonths,
      effectiveInstallmentCount
    );
    input = {
      ...input,
      term: effectiveInstallmentCount,
    };
  }

  const effectiveInterestOnlyInstallmentCount =
    planType === 'interestOnly'
      ? calculateInterestOnlyEffectiveInstallmentCount(input)
      : input.term;

  if (planType === 'prepaidInterest') {
    if (
      input.prepaidInterestAmount === undefined ||
      input.prepaidInterestAmount <= 0
    ) {
      throw new Error('Peşin faiz tutarı pozitif olmalıdır.');
    }
  }

  if (planType === 'interestOnly') {
    if (input.interestOnlyInstallmentCount === undefined) {
      throw new Error(
        'İlk dönem sadece faiz ödemeli plan için taksit sayısı girilmelidir.'
      );
    }

    if (!Number.isInteger(input.interestOnlyInstallmentCount)) {
      throw new Error(
        'İlk dönem sadece faiz ödemeli taksit sayısı tam sayı olmalıdır.'
      );
    }

    if (input.interestOnlyInstallmentCount <= 0) {
      throw new Error(
        'İlk dönem sadece faiz ödemeli taksit sayısı pozitif olmalıdır.'
      );
    }

    if (effectiveInterestOnlyInstallmentCount <= 1) {
      throw new Error(
        'İlk dönem sadece faiz ödemeli plan için vade içinde en az 2 taksit tarihi oluşmalıdır.'
      );
    }

    if (
      input.interestOnlyInstallmentCount >=
      effectiveInterestOnlyInstallmentCount
    ) {
      throw new Error(
        'İlk dönem sadece faiz ödemeli taksit sayısı efektif taksit sayısından küçük olmalıdır.'
      );
    }
  }

  if (planType === 'increasingInstallment') {
    if (input.installmentIncreaseRatePercent === undefined) {
      throw new Error('Artan taksitli plan için artış oranı girilmelidir.');
    }

    if (
      !Number.isFinite(input.installmentIncreaseRatePercent) ||
      input.installmentIncreaseRatePercent <= 0
    ) {
      throw new Error('Artan taksit oranı pozitif olmalıdır.');
    }

    if (input.term <= 1) {
      throw new Error('Artan taksitli plan için vade 1 aydan büyük olmalıdır.');
    }

    if (input.installmentIncreaseFrequencyMonths === undefined) {
      throw new Error('Artan taksitli plan için artış sıklığı girilmelidir.');
    }

    if (
      !Number.isInteger(input.installmentIncreaseFrequencyMonths)
    ) {
      throw new Error('Artış sıklığı tam sayı olmalıdır.');
    }

    if (input.installmentIncreaseFrequencyMonths <= 0) {
      throw new Error('Artış sıklığı pozitif olmalıdır.');
    }

    if (input.installmentIncreaseFrequencyMonths > input.term) {
      throw new Error('Artış sıklığı vadeden büyük olamaz.');
    }

    if (input.installmentIncreaseStartNo === undefined) {
      throw new Error('Artış başlangıç taksiti girilmelidir.');
    }

    if (!Number.isInteger(input.installmentIncreaseStartNo)) {
      throw new Error('Artış başlangıç taksiti tam sayı olmalıdır.');
    }

    if (input.installmentIncreaseStartNo <= 0) {
      throw new Error('Artış başlangıç taksiti pozitif olmalıdır.');
    }

    if (input.installmentIncreaseEndNo === undefined) {
      throw new Error('Artış bitiş taksiti girilmelidir.');
    }

    if (!Number.isInteger(input.installmentIncreaseEndNo)) {
      throw new Error('Artış bitiş taksiti tam sayı olmalıdır.');
    }

    if (input.installmentIncreaseEndNo <= 0) {
      throw new Error('Artış bitiş taksiti pozitif olmalıdır.');
    }

    if (input.installmentIncreaseStartNo > input.installmentIncreaseEndNo) {
      throw new Error('Artış başlangıç taksiti bitiş taksitinden büyük olamaz.');
    }

    if (input.installmentIncreaseStartNo > input.term) {
      throw new Error('Artış başlangıç taksiti vadeden büyük olamaz.');
    }

    if (input.installmentIncreaseEndNo > input.term) {
      throw new Error('Artış bitiş taksiti vadeden büyük olamaz.');
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
  let interestOnlyInstallmentCount: number | undefined;
  let postInterestOnlyInstallmentAmount: number | undefined;
  let installmentIncreaseRatePercent: number | undefined;
  let installmentIncreaseFrequencyMonths: number | undefined;
  let installmentIncreaseStartNo: number | undefined;
  let installmentIncreaseEndNo: number | undefined;
  let baseIncreasingInstallmentAmount: number | undefined;
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

  if (planType === 'interestOnly') {
    interestOnlyInstallmentCount = input.interestOnlyInstallmentCount ?? 0;
    postInterestOnlyInstallmentAmount = calculateStandardInstallment(
      input.principal,
      effectiveInterestOnlyInstallmentCount - interestOnlyInstallmentCount,
      effectiveMonthlyInterestRate,
      kkdfRate,
      bsmvRate
    );
  }

  const brokenPeriod = calculateBrokenPeriod(
    input,
    effectiveMonthlyInterestRate,
    kkdfRate,
    bsmvRate,
    deductedDelayMonths > 0
      ? firstInstallmentDelayMonths
      : 1
  );

  const customPaymentScheduleResult =
    planType === 'customPayment' && customPaymentMap
      ? buildCustomPaymentSchedule(
          input,
          effectiveMonthlyInterestRate,
          kkdfRate,
          bsmvRate,
          customPaymentMap,
          brokenPeriod
        )
      : undefined;

  if (customPaymentScheduleResult) {
    automaticInstallmentAmount = customPaymentScheduleResult.automaticInstallmentAmount;
  }

  if (planType === 'increasingInstallment') {
    installmentIncreaseRatePercent = input.installmentIncreaseRatePercent ?? 0;
    if (input.installmentIncreaseFrequencyMonths === undefined) {
      throw new Error('Artan taksitli plan için artış sıklığı girilmelidir.');
    }

    installmentIncreaseFrequencyMonths = input.installmentIncreaseFrequencyMonths;
    installmentIncreaseStartNo = input.installmentIncreaseStartNo;
    installmentIncreaseEndNo = input.installmentIncreaseEndNo;

    if (
      installmentIncreaseStartNo === undefined ||
      installmentIncreaseEndNo === undefined
    ) {
      throw new Error('Artan taksitli plan için artış taksit aralığı girilmelidir.');
    }

    const increaseRate = installmentIncreaseRatePercent / 100;
    baseIncreasingInstallmentAmount = solveIncreasingBaseInstallment(
      input,
      effectiveMonthlyInterestRate,
      kkdfRate,
      bsmvRate,
      brokenPeriod,
      increaseRate,
      installmentIncreaseFrequencyMonths,
      installmentIncreaseStartNo,
      installmentIncreaseEndNo,
      standardInstallment
    );
  }

  const baseSchedule =
    customPaymentScheduleResult
      ? customPaymentScheduleResult.schedule
      : planType === 'equalPrincipal'
        ? buildEqualPrincipalSchedule(
            input,
            effectiveMonthlyInterestRate,
            kkdfRate,
            bsmvRate
          )
        : planType === 'interestOnly' &&
            interestOnlyInstallmentCount !== undefined &&
            postInterestOnlyInstallmentAmount !== undefined
          ? buildInterestOnlySchedule(
              input,
              effectiveMonthlyInterestRate,
              kkdfRate,
              bsmvRate,
              brokenPeriod,
              effectiveInterestOnlyInstallmentCount,
              interestOnlyInstallmentCount,
              postInterestOnlyInstallmentAmount
            )
          : planType === 'increasingInstallment' &&
              installmentIncreaseRatePercent !== undefined &&
              installmentIncreaseFrequencyMonths !== undefined &&
              installmentIncreaseStartNo !== undefined &&
              installmentIncreaseEndNo !== undefined &&
              baseIncreasingInstallmentAmount !== undefined
            ? buildIncreasingInstallmentSchedule(
                input,
                effectiveMonthlyInterestRate,
                kkdfRate,
                bsmvRate,
                brokenPeriod,
                installmentIncreaseRatePercent / 100,
                installmentIncreaseFrequencyMonths,
                installmentIncreaseStartNo,
                installmentIncreaseEndNo,
                baseIncreasingInstallmentAmount
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
      planType === 'interestOnly' ||
      planType === 'increasingInstallment' ||
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

  if (planType === 'interestOnly') {
    const finalRemainingPrincipal =
      schedule[schedule.length - 1]?.remainingPrincipal ?? input.principal;
    const totalPrincipal = schedule.reduce(
      (total, item) => roundToCents(total + item.principal),
      0
    );

    if (Math.abs(finalRemainingPrincipal) > 0.01) {
      throw new Error(
        'İlk dönem sadece faiz ödemeli plan vade sonunda kalan anaparayı kapatmalıdır.'
      );
    }

    if (Math.abs(totalPrincipal - input.principal) > 0.01) {
      throw new Error(
        'İlk dönem sadece faiz ödemeli plan toplam anaparayı kredi tutarına eşitlemelidir.'
      );
    }
  }

  if (planType === 'increasingInstallment') {
    const finalRemainingPrincipal =
      schedule[schedule.length - 1]?.remainingPrincipal ?? input.principal;
    const totalPrincipal = schedule.reduce(
      (total, item) => roundToCents(total + item.principal),
      0
    );

    if (Math.abs(finalRemainingPrincipal) > 0.01) {
      throw new Error('Artan taksitli plan vade sonunda kalan anaparayı kapatmalıdır.');
    }

    if (Math.abs(totalPrincipal - input.principal) > 0.01) {
      throw new Error('Artan taksitli plan toplam anaparayı kredi tutarına eşitlemelidir.');
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
  const resultEffectiveInstallmentCount =
    planType === 'interestOnly' ? effectiveInterestOnlyInstallmentCount : input.term;

  return {
    input: originalInput,
    planType,
    standardInstallment,
    firstInstallment:
      planType === 'prepaidInterest'
        ? schedule.find((item) => item.installmentNumber === 1)?.installment ?? 0
        : schedule[0]?.installment ?? 0,
    schedule,
    brokenPeriod,
    deductFirstInstallmentDelayFromTerm:
      originalInput.deductFirstInstallmentDelayFromTerm === true,
    firstInstallmentDelayMonths,
    deductedDelayMonths,
    effectiveInstallmentCount: resultEffectiveInstallmentCount,
    discountedMonthlyRate,
    prepaidInterestInput,
    realizedPrepaidInterest,
    monthlyPrincipalAmount,
    interestOnlyInstallmentCount,
    postInterestOnlyInstallmentAmount,
    installmentIncreaseRatePercent,
    installmentIncreaseFrequencyMonths,
    installmentIncreaseStartNo,
    installmentIncreaseEndNo,
    baseInstallmentAmount: baseIncreasingInstallmentAmount,
    firstInstallmentAmount:
      planType === 'prepaidInterest'
        ? schedule.find((item) => item.installmentNumber === 1)?.installment
        : schedule[0]?.installment,
    lastInstallmentAmount: schedule[schedule.length - 1]?.installment,
    automaticInstallmentAmount,
    infoMessages: firstInstallmentDelayInfo ? [firstInstallmentDelayInfo] : [],
    warnings: [],
    ...totals,
  };
};
