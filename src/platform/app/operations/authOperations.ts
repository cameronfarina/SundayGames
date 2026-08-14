import type {
  AcceptedAuthRequest,
  AccountRecord,
  CreateUserInput,
  LoginInput,
  LoginResult,
  PasswordReplacementResult,
  RequestEmailVerificationInput,
  RequestPasswordResetInput,
  ResetPasswordWithTokenInput,
  VerifyEmailInput,
} from "../../auth.js";
import type { ChangePlatformPasswordInput, LogoutInput } from "../contracts/account.js";
import type { PlatformAppContext } from "../context.js";
import { cloneForRead } from "../shared.js";

export const createAuthOperations = (context: PlatformAppContext) => ({
  createAccount: async (input: CreateUserInput): Promise<AccountRecord> =>
    cloneForRead(await context.auth.createUser(input)),

  login: async (input: LoginInput): Promise<LoginResult | null> => {
    const login = await context.auth.login(input);
    return login === null ? null : cloneForRead(login);
  },

  requestEmailVerification: async (
    input: RequestEmailVerificationInput,
  ): Promise<AcceptedAuthRequest> => await context.auth.requestEmailVerification(input),

  verifyEmail: async (input: VerifyEmailInput): Promise<AccountRecord> =>
    cloneForRead(await context.auth.verifyEmail(input)),

  requestPasswordReset: async (
    input: RequestPasswordResetInput,
  ): Promise<AcceptedAuthRequest> => await context.auth.requestPasswordReset(input),

  resetPasswordWithToken: async (
    input: ResetPasswordWithTokenInput,
  ): Promise<PasswordReplacementResult> => cloneForRead(await context.auth.resetPasswordWithToken(input)),

  findAccountByEmail: async (email: string): Promise<AccountRecord | null> => {
    const credential = await context.authRepository.findAccountCredentialByEmail(email.trim().toLowerCase());
    return credential === null ? null : cloneForRead(credential.account);
  },

  findAccountBySessionToken: async (
    sessionToken: string,
    now?: Date,
  ): Promise<AccountRecord | null> => {
    const authenticated = await context.auth.lookupSession(sessionToken, now);
    return authenticated === null ? null : cloneForRead(authenticated.account);
  },

  logout: async (input: LogoutInput): Promise<boolean> =>
    await context.auth.logout(input.actorSessionToken, input.now),

  changePassword: async (
    input: ChangePlatformPasswordInput,
  ): Promise<PasswordReplacementResult> => cloneForRead(await context.auth.changePassword({
    sessionToken: input.actorSessionToken,
    currentPassword: input.currentPassword,
    newPassword: input.newPassword,
    newPasswordConfirmation: input.newPasswordConfirmation,
    now: input.now,
  })),
});
