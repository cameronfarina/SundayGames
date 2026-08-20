import {
  createLeagueConnectionCredentialCipher,
  type LeagueConnectionCredentialCipher,
} from "../leagueConnectionCredentialEncryption.js";
import type { PlatformRuntimeEnv } from "./contracts.js";
import { optionalEnvString } from "./env.js";

const activeKeyIdEnv = "MOCKD_LEAGUE_CONNECTION_CREDENTIAL_ACTIVE_KEY_ID";
const keyringEnv = "MOCKD_LEAGUE_CONNECTION_CREDENTIAL_KEYS";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const keyringFrom = (value: string): Readonly<Record<string, string>> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${keyringEnv} must be a JSON object of key ids to base64 keys.`);
  }
  if (!isRecord(parsed)) {
    throw new Error(`${keyringEnv} must be a JSON object of key ids to base64 keys.`);
  }
  const keys: Record<string, string> = {};
  for (const [keyId, encodedKey] of Object.entries(parsed)) {
    if (typeof encodedKey !== "string") {
      throw new Error(`${keyringEnv} must contain only base64 string values.`);
    }
    keys[keyId] = encodedKey;
  }
  return keys;
};

export const leagueConnectionCredentialCipherFromEnv = (
  env: PlatformRuntimeEnv,
): LeagueConnectionCredentialCipher | undefined => {
  const activeKeyId = optionalEnvString(env, activeKeyIdEnv);
  const encodedKeyring = optionalEnvString(env, keyringEnv);
  if (activeKeyId === undefined && encodedKeyring === undefined) return undefined;
  if (activeKeyId === undefined || encodedKeyring === undefined) {
    throw new Error(`${activeKeyIdEnv} and ${keyringEnv} must be configured together.`);
  }
  return createLeagueConnectionCredentialCipher({
    activeKeyId,
    keys: keyringFrom(encodedKeyring),
  });
};

export const assertProductionLeagueConnectionCredentialEncryption = (
  cipher: LeagueConnectionCredentialCipher | undefined,
): void => {
  if (cipher === undefined) {
    throw new Error(`${keyringEnv} is required in production.`);
  }
};
