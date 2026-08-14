export const slugFor = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "player";

export const formatOneDecimal = (value: number): string => value.toFixed(1);

export const roundToOneDecimal = (value: number): number => Number(formatOneDecimal(value));

export const formatSigned = (value: number): string => `${value >= 0 ? "+" : ""}${formatOneDecimal(value)}`;

export const sentenceFrom = (value: string): string => value.trim().replace(/[.!?]+$/g, "");
