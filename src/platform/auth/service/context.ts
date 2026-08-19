import type { AuthMailSender } from "../mailContracts.js";
import {
  defaultPasswordResetTokenTtlMs,
  defaultSessionTtlMs,
  defaultVerificationTokenTtlMs,
  hashServicePassword,
} from "../primitives.js";
import type { AuthRepository } from "../repositoryContracts.js";
import type { CreateAuthServiceOptions } from "../serviceContracts.js";
import type { SignupNotifier } from "../signupNotifierContracts.js";

export interface AuthServiceContext {
  repository: AuthRepository;
  sessionTtlMs: number;
  emailVerificationRequired: boolean;
  mailSender: AuthMailSender | undefined;
  publicBaseUrl: string | undefined;
  verificationTokenTtlMs: number;
  passwordResetTokenTtlMs: number;
  passwordHasher: (password: string) => Promise<string>;
  signupNotifier: SignupNotifier | undefined;
}

export const createAuthServiceContext = (options: CreateAuthServiceOptions): AuthServiceContext => ({
  repository: options.repository,
  sessionTtlMs: options.sessionTtlMs ?? defaultSessionTtlMs,
  emailVerificationRequired: options.emailVerificationRequired ?? false,
  mailSender: options.mailSender,
  publicBaseUrl: options.publicBaseUrl,
  verificationTokenTtlMs: options.verificationTokenTtlMs ?? defaultVerificationTokenTtlMs,
  passwordResetTokenTtlMs: options.passwordResetTokenTtlMs ?? defaultPasswordResetTokenTtlMs,
  passwordHasher: options.passwordHasher ?? hashServicePassword,
  signupNotifier: options.signupNotifier,
});
