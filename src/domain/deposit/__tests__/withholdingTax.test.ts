import {
  describeWithholdingTaxBracket,
  suggestWithholdingTaxRate,
} from '../withholdingTax';

describe('suggestWithholdingTaxRate', () => {
  it('uses the short-term bracket up to and including 180 days', () => {
    expect(suggestWithholdingTaxRate(32)).toBe(17.5);
    expect(suggestWithholdingTaxRate(180)).toBe(17.5);
  });

  it('moves to the mid bracket just past 180 days', () => {
    expect(suggestWithholdingTaxRate(181)).toBe(15);
    expect(suggestWithholdingTaxRate(365)).toBe(15);
  });

  it('uses the long-term bracket past a year', () => {
    expect(suggestWithholdingTaxRate(366)).toBe(10);
    expect(suggestWithholdingTaxRate(1000)).toBe(10);
  });

  it('falls back to the shortest bracket for unusable terms', () => {
    expect(suggestWithholdingTaxRate(0)).toBe(17.5);
    expect(suggestWithholdingTaxRate(Number.NaN)).toBe(17.5);
  });

  it('names the bracket a term falls into', () => {
    expect(describeWithholdingTaxBracket(92)).toBe('6 aya kadar');
    expect(describeWithholdingTaxBracket(200)).toBe('6 ay - 1 yıl');
    expect(describeWithholdingTaxBracket(400)).toBe('1 yıldan uzun');
  });
});
