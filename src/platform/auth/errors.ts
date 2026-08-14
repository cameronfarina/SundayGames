export type AuthErrorCode =
  | "auth_required"
  | "duplicate_email"
  | "email_unverified"
  | "invalid_current_password"
  | "invalid_email"
  | "invalid_or_expired_token"
  | "invalid_password"
  | "password_change_conflict"
  | "password_confirmation_mismatch"
  | "password_unchanged";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}
