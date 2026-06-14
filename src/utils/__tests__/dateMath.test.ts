import { addMonths, daysBetween, parseTurkishDate } from '../dateMath';

describe('dateMath', () => {
  it('parses Turkish date format', () => {
    const parsed = parseTurkishDate('12.06.2026');

    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(5);
    expect(parsed?.getDate()).toBe(12);
  });

  it('uses valid month end dates', () => {
    expect(addMonths(new Date(2026, 0, 31), 1)).toEqual(
      new Date(2026, 1, 28)
    );
    expect(addMonths(new Date(2028, 0, 31), 1)).toEqual(
      new Date(2028, 1, 29)
    );
  });

  it('calculates signed day differences', () => {
    expect(daysBetween(new Date(2026, 6, 1), new Date(2026, 6, 15))).toBe(14);
    expect(daysBetween(new Date(2026, 6, 1), new Date(2026, 5, 20))).toBe(-11);
  });
});
