export const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const average = (values: readonly number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
