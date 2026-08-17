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

/**
 * An unmapped column falls back to its headerless position, so a header that
 * names no email still reads whatever sits in that slot. Invitations go to
 * these addresses, so anything without an "@" is discarded rather than mailed.
 */
export const normalizeEmail = (email: string): string | undefined => {
  const normalizedEmail = email.trim().toLowerCase();

  return normalizedEmail.includes("@") ? normalizedEmail : undefined;
};
