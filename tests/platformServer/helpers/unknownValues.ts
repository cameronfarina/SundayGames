export const propertyValue = (value: unknown, property: string): unknown => {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Expected object property ${property}.`);
  }
  const entry = Object.entries(value).find(([key]) => key === property);
  if (entry === undefined) throw new Error(`Expected object property ${property}.`);
  return entry[1];
};

export const stringProperty = (value: unknown, property: string): string => {
  const result = propertyValue(value, property);
  if (typeof result !== "string") throw new Error(`Expected string property ${property}.`);
  return result;
};

export const arrayProperty = (value: unknown, property: string): readonly unknown[] => {
  const result = propertyValue(value, property);
  if (!Array.isArray(result)) throw new Error(`Expected array property ${property}.`);
  return result;
};
