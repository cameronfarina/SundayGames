import {
  createCipheriv,
  createDecipheriv,
  createSecretKey,
  randomBytes,
  type KeyObject,
} from "node:crypto";
import {
  authenticationTagBytes,
  configurationError,
  credentialEnvelopeVersion,
  dataKeyBytes,
  initializationVectorBytes,
  type LeagueConnectionCredentialContext,
  type LeagueConnectionCredentialKeyringConfig,
} from "./contracts.js";

const algorithm = "aes-256-gcm";
const keyIdPattern = /^[A-Za-z0-9._-]{1,64}$/u;

export interface AuthenticatedCiphertext {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
}

export const aadFor = (
  purpose: "data" | "key",
  keyId: string,
  context: LeagueConnectionCredentialContext,
): Buffer => Buffer.from(JSON.stringify([
  "sunday-games-league-connection-credentials",
  credentialEnvelopeVersion,
  purpose,
  keyId,
  context.accountId,
  context.providerLeagueId,
  context.season,
]), "utf8");

export const encryptBytes = (
  key: KeyObject,
  plaintext: Buffer,
  aad: Buffer,
): AuthenticatedCiphertext => {
  const iv = randomBytes(initializationVectorBytes);
  const cipher = createCipheriv(algorithm, key, iv, { authTagLength: authenticationTagBytes });
  cipher.setAAD(aad);
  return {
    ciphertext: Buffer.concat([cipher.update(plaintext), cipher.final()]),
    iv,
    tag: cipher.getAuthTag(),
  };
};

export const decryptBytes = (
  key: KeyObject,
  encrypted: AuthenticatedCiphertext,
  aad: Buffer,
): Buffer => {
  const decipher = createDecipheriv(algorithm, key, encrypted.iv, {
    authTagLength: authenticationTagBytes,
  });
  decipher.setAAD(aad);
  decipher.setAuthTag(encrypted.tag);
  return Buffer.concat([decipher.update(encrypted.ciphertext), decipher.final()]);
};

const canonicalBase64Key = (value: string): Buffer => {
  const key = Buffer.from(value, "base64");
  if (key.length !== dataKeyBytes || key.toString("base64") !== value) {
    key.fill(0);
    throw configurationError(
      "Every MOCKD_LEAGUE_CONNECTION_CREDENTIAL_KEYS value must be a canonical base64-encoded 32-byte key.",
    );
  }
  return key;
};

export const keyObjectsFor = (
  config: LeagueConnectionCredentialKeyringConfig,
): ReadonlyMap<string, KeyObject> => {
  if (!keyIdPattern.test(config.activeKeyId)) {
    throw configurationError(
      "MOCKD_LEAGUE_CONNECTION_CREDENTIAL_ACTIVE_KEY_ID must use 1-64 letters, digits, dots, underscores, or hyphens.",
    );
  }
  const keys = new Map<string, KeyObject>();
  for (const [keyId, encodedKey] of Object.entries(config.keys)) {
    if (!keyIdPattern.test(keyId)) {
      throw configurationError(
        "Every MOCKD_LEAGUE_CONNECTION_CREDENTIAL_KEYS key id must use 1-64 letters, digits, dots, underscores, or hyphens.",
      );
    }
    const keyBytes = canonicalBase64Key(encodedKey);
    try {
      keys.set(keyId, createSecretKey(keyBytes));
    } finally {
      keyBytes.fill(0);
    }
  }
  if (!keys.has(config.activeKeyId)) {
    throw configurationError(
      "MOCKD_LEAGUE_CONNECTION_CREDENTIAL_ACTIVE_KEY_ID must name a configured credential key.",
    );
  }
  return keys;
};

export const newDataKey = (): Buffer => randomBytes(dataKeyBytes);
export const keyObjectFor = (key: Buffer): KeyObject => createSecretKey(key);
