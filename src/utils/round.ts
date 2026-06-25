export const roundToCents = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;

  return Object.is(rounded, -0) ? 0 : rounded;
};
