export const normalizedIdentity = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[.'’]/gu, "")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");

export const namePartAliases = (value: string): string[] => {
  const normalized = normalizedIdentity(value);
  const parts = normalized.split(" ").filter(Boolean);
  const first = parts[0];
  const last = parts[parts.length - 1];

  return [
    normalized,
    ...(first === undefined ? [] : [first]),
    ...(last === undefined || last === first ? [] : [last]),
  ];
};
