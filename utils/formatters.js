export const formatMoney = (amount) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace('TRL', 'TL');
};

export const formatInput = (value) => {
  const numbers = value.replace(/[^0-9,]/g, '');
  const parts = numbers.split(',');
  if (parts.length > 2) return parts[0] + ',' + parts[1];

  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return parts.length === 2 ? `${integerPart},${parts[1]}` : integerPart;
};
