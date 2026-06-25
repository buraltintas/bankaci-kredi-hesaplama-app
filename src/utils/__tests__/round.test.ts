import { roundToCents } from '../round';

describe('roundToCents', () => {
  it('normalizes negative zero to zero', () => {
    expect(Object.is(roundToCents(-0.001), -0)).toBe(false);
    expect(roundToCents(-0.001)).toBe(0);
  });
});
