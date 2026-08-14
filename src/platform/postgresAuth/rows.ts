export interface AccountRow {
  id: string;
  email: string;
  password_hash: string;
  email_verified_at: Date | string | null;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface PendingAccountRow extends AccountRow {
  was_inserted: boolean;
  auth_version: string | number;
}

export interface AuthTokenRow {
  id: string;
  account_id: string;
  purpose: "email_verification" | "password_reset";
  token_hash: string;
  created_at: Date | string;
  expires_at: Date | string;
  consumed_at: Date | string | null;
  auth_version: string | number;
}

export interface SessionRow {
  id: string;
  account_id: string;
  token_hash: string;
  created_at: Date | string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
}

export interface PasswordReplacementRow extends AccountRow {
  revoked_session_count: string | number;
}
