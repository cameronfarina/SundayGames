export const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const roundNullableToTwo = (value: number | null): number | null =>
  value === null ? null : roundToTwo(value);

export const average = (values: readonly number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
