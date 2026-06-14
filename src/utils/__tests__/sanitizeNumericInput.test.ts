import {
  parseNumericInput,
  sanitizeNumericInput,
} from '../sanitizeNumericInput';

describe('sanitizeNumericInput', () => {
  it('blocks spaces in decimal inputs', () => {
    expect(sanitizeNumericInput('1, 49')).toBe('1,49');
    expect(sanitizeNumericInput('1 49')).toBe('149');
  });

  it('supports comma and dot decimal separators', () => {
    expect(parseNumericInput('3,49').value).toBe(3.49);
    expect(parseNumericInput('3.49').value).toBe(3.49);
  });

  it('removes pasted letters and keeps one decimal separator', () => {
    expect(sanitizeNumericInput('abc1.49')).toBe('1,49');
    expect(sanitizeNumericInput('1..49')).toBe('1,49');
    expect(sanitizeNumericInput('1,,49')).toBe('1,49');
  });

  it('keeps term inputs as positive integers only', () => {
    expect(sanitizeNumericInput('12.5', 'integer')).toBe('12');
    expect(parseNumericInput('12.5', 'integer')).toEqual({
      isValid: true,
      value: 12,
    });
  });

  it('formats money inputs with Turkish thousand groups', () => {
    expect(sanitizeNumericInput('abc125000,50', 'money')).toBe('125.000,50');
    expect(parseNumericInput('125.000,50', 'money').value).toBe(125000.5);
  });
});
