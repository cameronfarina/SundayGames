export const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const average = (values: readonly number[]): number =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;

export const ordinal = (rank: number): string => {
  const lastTwo = rank % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${rank}th`;
  if (rank % 10 === 1) return `${rank}st`;
  if (rank % 10 === 2) return `${rank}nd`;
  if (rank % 10 === 3) return `${rank}rd`;
  return `${rank}th`;
};

export const scoreText = (value: number): string =>
  roundToTwo(value).toFixed(1);

export const moneyText = (value: number): string =>
  `$${Math.round(value)}`;
