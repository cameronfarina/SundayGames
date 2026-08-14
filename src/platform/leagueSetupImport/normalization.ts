export const normalizeHeader = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

export const normalizeDuplicateKey = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

export const slugFor = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const normalizeEmail = (email: string): string | undefined => {
  const normalizedEmail = email.trim().toLowerCase();

  return normalizedEmail.length > 0 ? normalizedEmail : undefined;
};
