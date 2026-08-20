import type { LeagueConnectionCredentials } from "../leagueConnections.js";

export const credentialEnvelopeVersion = 1;
export const dataKeyBytes = 32;
export const initializationVectorBytes = 12;
export const authenticationTagBytes = 16;

export interface LeagueConnectionCredentialContext {
  accountId: string;
  providerLeagueId: string;
  season: string;
}

export interface EncryptedLeagueConnectionCredentials {
  ciphertext: string;
  keyId: string;
}

export interface LeagueConnectionCredentialKeyringConfig {
  activeKeyId: string;
  keys: Readonly<Record<string, string>>;
}

export interface LeagueConnectionCredentialCipher {
  readonly activeKeyId: string;
  decrypt(
    encrypted: EncryptedLeagueConnectionCredentials,
    context: LeagueConnectionCredentialContext,
  ): LeagueConnectionCredentials;
  encrypt(
    credentials: LeagueConnectionCredentials,
    context: LeagueConnectionCredentialContext,
  ): EncryptedLeagueConnectionCredentials;
}

export class LeagueConnectionCredentialEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeagueConnectionCredentialEncryptionError";
  }
}

export const configurationError = (
  message: string,
): LeagueConnectionCredentialEncryptionError =>
  new LeagueConnectionCredentialEncryptionError(message);

export const storedCredentialError = (): LeagueConnectionCredentialEncryptionError =>
  new LeagueConnectionCredentialEncryptionError("Stored ESPN credentials could not be decrypted.");
