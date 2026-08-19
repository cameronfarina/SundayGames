import { AuthError } from "../errors.js";
import { hashSessionToken } from "../primitives.js";
import type { AccountRecord } from "../records.js";
import type { UpdateDisplayNameInput } from "../serviceContracts.js";
import type { AuthServiceContext } from "./context.js";

export const maximumDisplayNameCharacters = 40;

/** Collapses runs of whitespace so a name cannot be padded into a different one. */
const normalizeDisplayName = (displayName: string): string =>
  displayName.trim().replace(/\s+/gu, " ");

export const validatedDisplayName = (displayName: string): string | undefined => {
  const normalized = normalizeDisplayName(displayName);
  if (normalized.length === 0) return undefined;
  if (normalized.length > maximumDisplayNameCharacters) {
    throw new AuthError(
      "invalid_display_name",
      `Display name must be no more than ${String(maximumDisplayNameCharacters)} characters.`,
    );
  }
  return normalized;
};

export const updateDisplayName = async (
  context: AuthServiceContext,
  input: UpdateDisplayNameInput,
): Promise<AccountRecord> => {
  const now = input.now ?? new Date();
  const session = await context.repository.findSessionByTokenHash(hashSessionToken(input.sessionToken));
  if (session === null || session.revokedAt !== undefined || session.expiresAt <= now) {
    throw new AuthError("auth_required", "Sign in before updating your profile.");
  }
  const displayName = validatedDisplayName(input.displayName);
  const account = await context.repository.replaceDisplayName({
    accountId: session.accountId,
    displayName,
    now,
  });
  if (account === null) {
    throw new AuthError("auth_required", "Sign in before updating your profile.");
  }
  return account;
};
