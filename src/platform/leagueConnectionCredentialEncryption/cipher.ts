import {
  credentialEnvelopeVersion,
  dataKeyBytes,
  LeagueConnectionCredentialEncryptionError,
  storedCredentialError,
  type LeagueConnectionCredentialCipher,
  type LeagueConnectionCredentialKeyringConfig,
} from "./contracts.js";
import {
  credentialPayload,
  credentialsFromPayload,
  encryptedBytesFrom,
  envelopeFrom,
  type CredentialEnvelopeV1,
} from "./codec.js";
import {
  aadFor,
  decryptBytes,
  encryptBytes,
  keyObjectFor,
  keyObjectsFor,
  newDataKey,
} from "./crypto.js";

export const createLeagueConnectionCredentialCipher = (
  config: LeagueConnectionCredentialKeyringConfig,
): LeagueConnectionCredentialCipher => {
  const keys = keyObjectsFor(config);
  const activeKey = keys.get(config.activeKeyId);
  if (activeKey === undefined) throw new Error("Credential encryption key configuration is invalid.");

  return {
    activeKeyId: config.activeKeyId,
    encrypt: (credentials, context) => {
      const dataKeyBytesValue = newDataKey();
      const dataKey = keyObjectFor(dataKeyBytesValue);
      const payload = credentialPayload(credentials);
      try {
        const data = encryptBytes(dataKey, payload, aadFor("data", config.activeKeyId, context));
        const wrappedKey = encryptBytes(
          activeKey,
          dataKeyBytesValue,
          aadFor("key", config.activeKeyId, context),
        );
        return {
          keyId: config.activeKeyId,
          ciphertext: JSON.stringify({
            v: credentialEnvelopeVersion,
            data: data.ciphertext.toString("base64url"),
            dataIv: data.iv.toString("base64url"),
            dataTag: data.tag.toString("base64url"),
            wrappedKey: wrappedKey.ciphertext.toString("base64url"),
            wrapIv: wrappedKey.iv.toString("base64url"),
            wrapTag: wrappedKey.tag.toString("base64url"),
          } satisfies CredentialEnvelopeV1),
        };
      } finally {
        payload.fill(0);
        dataKeyBytesValue.fill(0);
      }
    },
    decrypt: (encrypted, context) => {
      const key = keys.get(encrypted.keyId);
      if (key === undefined) throw storedCredentialError();
      try {
        const envelope = envelopeFrom(encrypted.ciphertext);
        const unwrappedKey = decryptBytes(
          key,
          encryptedBytesFrom(envelope.wrappedKey, envelope.wrapIv, envelope.wrapTag),
          aadFor("key", encrypted.keyId, context),
        );
        if (unwrappedKey.length !== dataKeyBytes) {
          unwrappedKey.fill(0);
          throw storedCredentialError();
        }
        const dataKey = keyObjectFor(unwrappedKey);
        unwrappedKey.fill(0);
        const payload = decryptBytes(
          dataKey,
          encryptedBytesFrom(envelope.data, envelope.dataIv, envelope.dataTag),
          aadFor("data", encrypted.keyId, context),
        );
        try {
          return credentialsFromPayload(payload);
        } finally {
          payload.fill(0);
        }
      } catch (error) {
        if (error instanceof LeagueConnectionCredentialEncryptionError) throw error;
        throw storedCredentialError();
      }
    },
  };
};
