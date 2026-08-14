import type { AuthMailSender } from "./mailContracts.js";
import type { AuthRepository } from "./repositoryContracts.js";
import type { AccountRecord, PasswordReplacementResult, SessionRecord } from "./records.js";

export interface CreateAuthServiceOptions {
  repository: AuthRepository;
  sessionTtlMs?: number | undefined;
  emailVerificationRequired?: boolean | undefined;
  mailSender?: AuthMailSender | undefined;
  publicBaseUrl?: string | undefined;
  verificationTokenTtlMs?: number | undefined;
  passwordResetTokenTtlMs?: number | undefined;
  passwordHasher?: ((password: string) => Promise<string>) | undefined;
}

export interface CreateUserInput {
  email: string;
  password?: string | undefined;
  verificationReturnTo?: string | undefined;
  now?: Date | undefined;
}

export interface LoginInput {
  email: string;
  password: string;
  now?: Date | undefined;
  sessionTtlMs?: number | undefined;
}

export interface LoginResult {
  account: AccountRecord;
  session: SessionRecord;
  sessionToken: string;
}

export interface AuthenticatedSession {
  account: AccountRecord;
  session: SessionRecord;
}

export interface ChangePasswordInput {
  sessionToken: string;
  currentPassword: string;
  newPassword: string;
  newPasswordConfirmation: string;
  now?: Date | undefined;
}

export interface ResetPasswordInput {
  email: string;
  newPassword: string;
  now?: Date | undefined;
}

export interface VerifyEmailInput {
  token: string;
  newPassword: string;
  newPasswordConfirmation: string;
  now?: Date | undefined;
}

export interface RequestEmailVerificationInput {
  email: string;
  verificationReturnTo?: string | undefined;
  now?: Date | undefined;
}

export interface RequestPasswordResetInput extends RequestEmailVerificationInput {}

export interface ResetPasswordWithTokenInput {
  token: string;
  newPassword: string;
  newPasswordConfirmation: string;
  now?: Date | undefined;
}

export interface AcceptedAuthRequest {
  accepted: true;
}

export interface AuthService {
  createUser(input: CreateUserInput): Promise<AccountRecord>;
  login(input: LoginInput): Promise<LoginResult | null>;
  lookupSession(sessionToken: string, now?: Date): Promise<AuthenticatedSession | null>;
  logout(sessionToken: string, now?: Date): Promise<boolean>;
  revokeSession(sessionId: string, now?: Date): Promise<boolean>;
  changePassword(input: ChangePasswordInput): Promise<PasswordReplacementResult>;
  resetPassword(input: ResetPasswordInput): Promise<PasswordReplacementResult | null>;
  requestEmailVerification(input: RequestEmailVerificationInput): Promise<AcceptedAuthRequest>;
  verifyEmail(input: VerifyEmailInput): Promise<AccountRecord>;
  requestPasswordReset(input: RequestPasswordResetInput): Promise<AcceptedAuthRequest>;
  resetPasswordWithToken(input: ResetPasswordWithTokenInput): Promise<PasswordReplacementResult>;
}
