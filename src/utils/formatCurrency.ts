const addTurkishThousandsSeparators = (value: string): string => {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const formatCurrency = (amount: number): string => {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const sign = safeAmount < 0 ? '-' : '';
  const [integerPart, decimalPart] = Math.abs(safeAmount).toFixed(2).split('.');
  const formattedInteger = addTurkishThousandsSeparators(integerPart);

  return `${sign}${formattedInteger},${decimalPart} TL`;
};
