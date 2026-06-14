import { sanitizeDateInput } from '../dateInput';

describe('sanitizeDateInput', () => {
  it('formats pasted digits as Turkish date text', () => {
    expect(sanitizeDateInput('01062026')).toBe('01.06.2026');
  });

  it('removes invalid characters and keeps partial edits usable', () => {
    expect(sanitizeDateInput('01/06/2026abc')).toBe('01.06.2026');
    expect(sanitizeDateInput('1')).toBe('1');
    expect(sanitizeDateInput('010')).toBe('01.0');
  });
});
