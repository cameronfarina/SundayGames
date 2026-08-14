export const dateFromDb = (
  value: Date | string | null | undefined,
): Date | undefined => {
  if (value === undefined || value === null) return undefined;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const requiredDateFromDb = (
  field: string,
  value: Date | string,
): Date => {
  const date = dateFromDb(value);
  if (date === undefined) {
    throw new Error(`Postgres simulation row has invalid ${field}.`);
  }
  return date;
};
