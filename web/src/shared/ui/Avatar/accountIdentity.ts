/** The name shown for an account, falling back to the email's local part. */
export const accountDisplayName = (email: string, displayName?: string): string => {
  const named = displayName?.trim() ?? "";
  if (named.length > 0) return named;
  const separatorIndex = email.indexOf("@");
  const localPart = email.slice(0, separatorIndex < 0 ? email.length : separatorIndex);
  return localPart.length > 0 ? localPart : email;
};

/** The first character of each word, whether words are split by space or punctuation. */
const wordLeadingCharacters = (name: string): readonly string[] =>
  name.match(/(?<=^|[\s._-])[^\s._-]/gu) ?? [];

/**
 * One or two letters for the avatar. A single word gives one letter rather than
 * two from the same word, so "cameron" reads as C and never CA.
 */
export const accountInitials = (email: string, displayName?: string): string => {
  const initials = wordLeadingCharacters(accountDisplayName(email, displayName))
    .slice(0, 2)
    .join("");
  return initials.length === 0 ? "A" : initials.toUpperCase();
};

/** How many tones Avatar.css paints. Keep the two in step. */
export const avatarToneCount = 8;

/**
 * A stable tone per account. Seeded by account id so a rename never changes the
 * colour a user has learned to recognise.
 */
export const avatarTone = (seed: string): number => {
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) % 100_000_007;
  }
  return hash % avatarToneCount;
};
