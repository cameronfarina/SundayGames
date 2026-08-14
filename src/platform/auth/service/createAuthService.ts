import type { AuthService, CreateAuthServiceOptions } from "../serviceContracts.js";
import { requestEmailVerification, requestPasswordReset, resetPasswordWithToken, verifyEmail } from "./actions.js";
import { createAuthServiceContext } from "./context.js";
import { createUser } from "./createUser.js";
import { changePassword, resetPassword } from "./passwords.js";
import { login, logout, lookupSession, revokeSession } from "./sessions.js";

export const createAuthService = (options: CreateAuthServiceOptions): AuthService => {
  const context = createAuthServiceContext(options);
  return {
    createUser: async input => await createUser(context, input),
    login: async input => await login(context, input),
    lookupSession: async (sessionToken, now) => await lookupSession(context, sessionToken, now),
    logout: async (sessionToken, now) => await logout(context, sessionToken, now),
    revokeSession: async (sessionId, now) => await revokeSession(context, sessionId, now),
    changePassword: async input => await changePassword(context, input),
    resetPassword: async input => await resetPassword(context, input),
    requestEmailVerification: async input => await requestEmailVerification(context, input),
    verifyEmail: async input => await verifyEmail(context, input),
    requestPasswordReset: async input => await requestPasswordReset(context, input),
    resetPasswordWithToken: async input => await resetPasswordWithToken(context, input),
  };
};
