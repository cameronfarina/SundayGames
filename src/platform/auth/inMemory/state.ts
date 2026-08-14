import type { AccountCredentialRecord, AuthTokenPurpose, AuthTokenRecord, SessionRecord } from "../records.js";

export class InMemoryAuthState {
  readonly accountsById = new Map<string, AccountCredentialRecord>();
  readonly accountIdsByEmail = new Map<string, string>();
  readonly sessionsById = new Map<string, SessionRecord>();
  readonly sessionIdsByTokenHash = new Map<string, string>();
  readonly authVersionsByAccountId = new Map<string, number>();
  readonly authVersionsBySessionId = new Map<string, number>();
  readonly authTokensByHash = new Map<string, AuthTokenRecord>();
  readonly authVersionsByTokenHash = new Map<string, number>();
  readonly claimedAuthTokenHashes = new Set<string>();

  validToken(tokenHash: string, purpose: AuthTokenPurpose, now: Date): AuthTokenRecord | null {
    const token = this.authTokensByHash.get(tokenHash);
    return token !== undefined
      && this.authVersionsByTokenHash.get(tokenHash) === this.authVersionsByAccountId.get(token.accountId)
      && token.purpose === purpose
      && token.consumedAt === undefined
      && token.expiresAt > now
      ? token
      : null;
  }

  clear(): void {
    this.accountsById.clear();
    this.accountIdsByEmail.clear();
    this.sessionsById.clear();
    this.sessionIdsByTokenHash.clear();
    this.authVersionsByAccountId.clear();
    this.authVersionsBySessionId.clear();
    this.authTokensByHash.clear();
    this.authVersionsByTokenHash.clear();
    this.claimedAuthTokenHashes.clear();
  }
}
