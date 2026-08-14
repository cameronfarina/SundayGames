import type { createAuthService, AccountRecord } from "../../auth.js";
import { PlatformAppError } from "../errors.js";

type AuthService = ReturnType<typeof createAuthService>;

export interface AccountAccess {
  requireAccount(sessionToken: string, now?: Date): Promise<AccountRecord>;
}

export const createAccountAccess = (auth: AuthService): AccountAccess => ({
  requireAccount: async (sessionToken, now) => {
    const authenticated = await auth.lookupSession(sessionToken, now);
    if (authenticated === null) {
      throw new PlatformAppError("auth_required", "Sign in before using this workspace.");
    }
    return authenticated.account;
  },
});
