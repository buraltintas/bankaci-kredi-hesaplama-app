export const whatsappPhone = (value: string) => {
  const normalized = value.trim();
  const digits = normalized.replace(/\D/g, '');

  if (normalized.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  return digits;
};
