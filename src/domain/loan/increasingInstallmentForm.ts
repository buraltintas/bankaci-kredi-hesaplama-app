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

export const parseInstallmentIncreaseBoundary = (
  value: string,
  term: number,
  label: 'başlangıç' | 'bitiş'
): number => {
  const normalized = value.trim().replace(/\s/g, '');
  const displayLabel =
    label === 'başlangıç' ? 'Artış başlangıç taksiti' : 'Artış bitiş taksiti';

  if (!normalized) {
    throw new Error(`${displayLabel} boş olamaz.`);
  }

  if (normalized.includes('-')) {
    throw new Error(`${displayLabel} negatif olamaz.`);
  }

  if (normalized.includes(',') || normalized.includes('.')) {
    throw new Error(`${displayLabel} tam sayı olmalıdır.`);
  }

  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${displayLabel} geçerli olmalıdır.`);
  }

  const boundary = Number(normalized);

  if (boundary === 0) {
    throw new Error(`${displayLabel} 0 olamaz.`);
  }

  if (boundary > term) {
    throw new Error(`${displayLabel} vadeden büyük olamaz.`);
  }

  return boundary;
};
