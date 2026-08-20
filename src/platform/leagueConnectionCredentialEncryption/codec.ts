import type { LeagueConnectionCredentials } from "../leagueConnections.js";
import {
  authenticationTagBytes,
  credentialEnvelopeVersion,
  initializationVectorBytes,
  storedCredentialError,
} from "./contracts.js";
import type { AuthenticatedCiphertext } from "./crypto.js";

const maximumEnvelopeBytes = 64 * 1024;

export interface CredentialEnvelopeV1 {
  v: 1;
  data: string;
  dataIv: string;
  dataTag: string;
  wrappedKey: string;
  wrapIv: string;
  wrapTag: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringField = (record: Record<string, unknown>, name: string): string => {
  const value = record[name];
  if (typeof value !== "string" || value.length === 0) throw storedCredentialError();
  return value;
};

export const envelopeFrom = (value: string): CredentialEnvelopeV1 => {
  if (Buffer.byteLength(value, "utf8") > maximumEnvelopeBytes) throw storedCredentialError();
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw storedCredentialError();
  }
  if (!isRecord(parsed) || parsed.v !== credentialEnvelopeVersion) {
    throw storedCredentialError();
  }
  return {
    v: credentialEnvelopeVersion,
    data: stringField(parsed, "data"),
    dataIv: stringField(parsed, "dataIv"),
    dataTag: stringField(parsed, "dataTag"),
    wrappedKey: stringField(parsed, "wrappedKey"),
    wrapIv: stringField(parsed, "wrapIv"),
    wrapTag: stringField(parsed, "wrapTag"),
  };
};

const decoded = (value: string, expectedBytes?: number): Buffer => {
  const result = Buffer.from(value, "base64url");
  if (
    result.length === 0
    || result.toString("base64url") !== value
    || (expectedBytes !== undefined && result.length !== expectedBytes)
  ) {
    result.fill(0);
    throw storedCredentialError();
  }
  return result;
};

export const encryptedBytesFrom = (
  ciphertext: string,
  iv: string,
  tag: string,
): AuthenticatedCiphertext => ({
  ciphertext: decoded(ciphertext),
  iv: decoded(iv, initializationVectorBytes),
  tag: decoded(tag, authenticationTagBytes),
});

export const credentialPayload = (credentials: LeagueConnectionCredentials): Buffer =>
  Buffer.from(JSON.stringify({
    ...(credentials.espnS2 === undefined ? {} : { espnS2: credentials.espnS2 }),
    ...(credentials.swid === undefined ? {} : { swid: credentials.swid }),
  }), "utf8");

export const credentialsFromPayload = (payload: Buffer): LeagueConnectionCredentials => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload.toString("utf8"));
  } catch {
    throw storedCredentialError();
  }
  if (!isRecord(parsed)) throw storedCredentialError();
  const espnS2 = parsed.espnS2;
  const swid = parsed.swid;
  if (
    (espnS2 !== undefined && typeof espnS2 !== "string")
    || (swid !== undefined && typeof swid !== "string")
    || (espnS2 === undefined && swid === undefined)
  ) throw storedCredentialError();
  return {
    ...(typeof espnS2 === "string" ? { espnS2 } : {}),
    ...(typeof swid === "string" ? { swid } : {}),
  };
};
