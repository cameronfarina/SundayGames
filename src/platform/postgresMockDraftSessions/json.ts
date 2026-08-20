export const jsonbParameter = (value: unknown): string => {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("Mock draft session data cannot be serialized as JSON.");
  return serialized;
};
