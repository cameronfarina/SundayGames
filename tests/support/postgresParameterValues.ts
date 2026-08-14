export const stringValueAt = (values: readonly unknown[], index: number): string => {
  const value = values[index];
  if (typeof value !== "string") throw new Error(`Expected string parameter ${index}.`);
  return value;
};

export const nullableStringValueAt = (
  values: readonly unknown[],
  index: number,
): string | null => {
  const value = values[index];
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`Expected nullable string parameter ${index}.`);
  return value;
};

export const dateValueAt = (values: readonly unknown[], index: number): Date => {
  const value = values[index];
  if (!(value instanceof Date)) throw new Error(`Expected Date parameter ${index}.`);
  return value;
};
