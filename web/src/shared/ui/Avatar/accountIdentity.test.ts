import { describe, expect, it } from "vitest";
import {
  accountDisplayName,
  accountInitials,
  avatarTone,
  avatarToneCount,
} from "./accountIdentity";

describe("accountDisplayName", () => {
  it("prefers the display name", () => {
    expect(accountDisplayName("cam@example.com", "Cam Farina")).toBe("Cam Farina");
  });

  it("trims a padded display name", () => {
    expect(accountDisplayName("cam@example.com", "  Cam  ")).toBe("Cam");
  });

  it("falls back to the email local part when there is no display name", () => {
    expect(accountDisplayName("cameron.farina@example.com")).toBe("cameron.farina");
  });

  it("falls back to the email local part when the display name is blank", () => {
    expect(accountDisplayName("cam@example.com", "   ")).toBe("cam");
  });

  it("keeps the whole value when there is no at sign", () => {
    expect(accountDisplayName("cameron")).toBe("cameron");
  });

  it("keeps the whole value when the email starts with the at sign", () => {
    expect(accountDisplayName("@example.com")).toBe("@example.com");
  });
});

describe("accountInitials", () => {
  it("takes one letter from each of the first two words", () => {
    expect(accountInitials("cam@example.com", "Cam Farina")).toBe("CF");
  });

  it("takes a single letter from a single word", () => {
    expect(accountInitials("cameron@example.com")).toBe("C");
  });

  it("splits an email local part on its punctuation", () => {
    expect(accountInitials("cameron.farina@example.com")).toBe("CF");
  });

  it("ignores words past the second", () => {
    expect(accountInitials("cam@example.com", "Cam Q Farina")).toBe("CQ");
  });

  it("falls back to A when nothing usable remains", () => {
    expect(accountInitials("...@example.com")).toBe("A");
  });
});

describe("avatarTone", () => {
  it("stays inside the tones the stylesheet paints", () => {
    for (const seed of ["account-1", "account-2", "", "zzz", "account-example"]) {
      expect(avatarTone(seed)).toBeGreaterThanOrEqual(0);
      expect(avatarTone(seed)).toBeLessThan(avatarToneCount);
    }
  });

  it("returns the same tone for the same seed", () => {
    expect(avatarTone("account-7")).toBe(avatarTone("account-7"));
  });

  it("separates seeds that differ", () => {
    const tones = new Set(["a", "b", "c", "d", "e", "f"].map(avatarTone));

    expect(tones.size).toBeGreaterThan(1);
  });
});
