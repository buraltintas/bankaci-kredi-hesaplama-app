export const parseInstallmentIncreaseRatePercent = (value: string): number => {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');

  if (!normalized) {
    throw new Error('Taksit artış oranı boş olamaz.');
  }

  if (normalized.includes('-')) {
    throw new Error('Taksit artış oranı negatif olamaz.');
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error('Taksit artış oranı geçerli olmalıdır.');
  }

  const increaseRate = Number(normalized);

  if (!Number.isFinite(increaseRate)) {
    throw new Error('Taksit artış oranı geçerli olmalıdır.');
  }

  if (increaseRate === 0) {
    throw new Error('Taksit artış oranı 0 olamaz.');
  }

  return increaseRate;
};

export const parseInstallmentIncreaseFrequencyMonths = (
  value: string,
  term: number
): number => {
  const normalized = value.trim().replace(/\s/g, '');

  if (!normalized) {
    throw new Error('Artış sıklığı boş olamaz.');
  }

  if (normalized.includes('-')) {
    throw new Error('Artış sıklığı negatif olamaz.');
  }

  if (normalized.includes(',') || normalized.includes('.')) {
    throw new Error('Artış sıklığı tam sayı olmalıdır.');
  }

  if (!/^\d+$/.test(normalized)) {
    throw new Error('Artış sıklığı geçerli olmalıdır.');
  }

  const frequencyMonths = Number(normalized);

  if (frequencyMonths === 0) {
    throw new Error('Artış sıklığı 0 olamaz.');
  }

  if (frequencyMonths > term) {
    throw new Error('Artış sıklığı vadeden büyük olamaz.');
  }

  return frequencyMonths;
};
