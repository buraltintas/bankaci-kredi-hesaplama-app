export const parseInterestOnlyInstallmentCount = (
  value: string,
  term: number
): number => {
  const normalized = value.trim().replace(/\s/g, '');

  if (!normalized) {
    throw new Error('Anapara ödemesiz taksit sayısı boş olamaz.');
  }

  if (normalized.includes('-')) {
    throw new Error('Anapara ödemesiz taksit sayısı negatif olamaz.');
  }

  if (normalized.includes(',') || normalized.includes('.')) {
    throw new Error('Anapara ödemesiz taksit sayısı tam sayı olmalıdır.');
  }

  if (!/^\d+$/.test(normalized)) {
    throw new Error('Anapara ödemesiz taksit sayısı geçerli olmalıdır.');
  }

  const installmentCount = Number(normalized);

  if (installmentCount === 0) {
    throw new Error('Anapara ödemesiz taksit sayısı 0 olamaz.');
  }

  if (installmentCount === term) {
    throw new Error(
      'Anapara ödemesiz taksit sayısı vade ile aynı olamaz. En az 1 taksit anapara kapatmak için kalmalıdır.'
    );
  }

  if (installmentCount > term) {
    throw new Error(
      'Anapara ödemesiz taksit sayısı vadeden büyük olamaz. En az 1 taksit anapara kapatmak için kalmalıdır.'
    );
  }

  return installmentCount;
};
