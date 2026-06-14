export type NumericInputMode = 'decimal' | 'integer' | 'money';

export type ParsedNumericInput = {
  isValid: boolean;
  value: number | null;
};

const stripInvalidCharacters = (value: string): string => {
  return value.replace(/\s/g, '').replace(/[^0-9,.]/g, '');
};

export const sanitizeNumericInput = (
  value: string,
  mode: NumericInputMode = 'decimal'
): string => {
  const cleaned = stripInvalidCharacters(value);

  if (mode === 'integer') {
    return cleaned.split(/[,.]/)[0];
  }

  if (mode === 'money') {
    const lastSeparatorIndex = Math.max(
      cleaned.lastIndexOf(','),
      cleaned.lastIndexOf('.')
    );
    const digitsOnly = cleaned.replace(/[,.]/g, '');
    const fractionalLength =
      lastSeparatorIndex >= 0 ? cleaned.length - lastSeparatorIndex - 1 : 0;
    const hasDecimalPart =
      lastSeparatorIndex >= 0 && fractionalLength > 0 && fractionalLength <= 2;

    if (!hasDecimalPart) {
      return digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    const integerPart = cleaned.slice(0, lastSeparatorIndex).replace(/[,.]/g, '');
    const decimalPart = cleaned.slice(lastSeparatorIndex + 1).replace(/[,.]/g, '');
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return `${formattedInteger},${decimalPart}`;
  }

  let output = '';
  let hasSeparator = false;

  for (const character of cleaned) {
    if (/\d/.test(character)) {
      output += character;
      continue;
    }

    if (!hasSeparator) {
      output += ',';
      hasSeparator = true;
    }
  }

  return output;
};

export const parseNumericInput = (
  value: string,
  mode: NumericInputMode = 'decimal'
): ParsedNumericInput => {
  const sanitized = sanitizeNumericInput(value, mode);
  const normalized =
    mode === 'money'
      ? sanitized.replace(/\./g, '').replace(',', '.')
      : sanitized.replace(',', '.');

  if (!normalized || normalized === '.') {
    return { isValid: false, value: null };
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return { isValid: false, value: null };
  }

  if (mode === 'integer' && (!Number.isInteger(parsed) || parsed <= 0)) {
    return { isValid: false, value: null };
  }

  return { isValid: true, value: parsed };
};
