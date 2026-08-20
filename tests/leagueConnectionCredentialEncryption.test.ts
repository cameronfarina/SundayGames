import { describe, expect, it } from "vitest";
import {
  createLeagueConnectionCredentialCipher,
  LeagueConnectionCredentialEncryptionError,
} from "../src/platform/leagueConnectionCredentialEncryption.js";

const oldKey = Buffer.alloc(32, 3).toString("base64");
const newKey = Buffer.alloc(32, 9).toString("base64");
const context = {
  accountId: "account-1",
  providerLeagueId: "899513",
  season: "2026",
};

describe("league connection credential encryption", () => {
  it("wraps a random data key without leaving credential text in the envelope", () => {
    const cipher = createLeagueConnectionCredentialCipher({
      activeKeyId: "credentials-2026-08",
      keys: { "credentials-2026-08": newKey },
    });
    const credentials = { espnS2: "s2-secret-value", swid: "{SECRET-GUID}" };

    const first = cipher.encrypt(credentials, context);
    const second = cipher.encrypt(credentials, context);

    expect(first.keyId).toBe("credentials-2026-08");
    expect(first.ciphertext).not.toContain(credentials.espnS2);
    expect(first.ciphertext).not.toContain(credentials.swid);
    expect(second.ciphertext).not.toBe(first.ciphertext);
    expect(cipher.decrypt(first, context)).toEqual(credentials);
  });

  it("decrypts an existing envelope while a newer key is active", () => {
    const originalCipher = createLeagueConnectionCredentialCipher({
      activeKeyId: "credentials-2026-07",
      keys: { "credentials-2026-07": oldKey },
    });
    const encrypted = originalCipher.encrypt({ espnS2: "old-s2", swid: "{OLD-GUID}" }, context);
    const rotatedCipher = createLeagueConnectionCredentialCipher({
      activeKeyId: "credentials-2026-08",
      keys: {
        "credentials-2026-07": oldKey,
        "credentials-2026-08": newKey,
      },
    });

    expect(rotatedCipher.decrypt(encrypted, context)).toEqual({
      espnS2: "old-s2",
      swid: "{OLD-GUID}",
    });
  });

  it("fails closed with a credential-free error when context or ciphertext is altered", () => {
    const cipher = createLeagueConnectionCredentialCipher({
      activeKeyId: "credentials-2026-08",
      keys: { "credentials-2026-08": newKey },
    });
    const encrypted = cipher.encrypt({ espnS2: "never-echo-this", swid: "{SECRET-GUID}" }, context);

    expect(() => cipher.decrypt(encrypted, { ...context, accountId: "account-2" }))
      .toThrow(LeagueConnectionCredentialEncryptionError);
    let thrown: unknown;
    try {
      cipher.decrypt({ ...encrypted, ciphertext: `${encrypted.ciphertext}tampered` }, context);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(LeagueConnectionCredentialEncryptionError);
    expect(String(thrown)).not.toContain("never-echo-this");
    expect(String(thrown)).not.toContain("{SECRET-GUID}");
  });

  it("rejects malformed or incomplete keyrings without echoing key material", () => {
    const secret = Buffer.alloc(32, 5).toString("base64");

    expect(() => createLeagueConnectionCredentialCipher({
      activeKeyId: "missing",
      keys: { configured: secret },
    })).toThrow("must name a configured credential key");
    try {
      createLeagueConnectionCredentialCipher({
        activeKeyId: "configured",
        keys: { configured: "too-short" },
      });
    } catch (error) {
      expect(String(error)).not.toContain("too-short");
    }
  });
});
