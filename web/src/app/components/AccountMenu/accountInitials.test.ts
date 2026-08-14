import { describe, expect, it } from "vitest";
import { accountInitials } from "./accountInitials";

describe("accountInitials", () => {
  it("uses the first two account-name segments", () => {
    expect(accountInitials("cameron.farina@example.com")).toBe("CF");
    expect(accountInitials("cam@example.com")).toBe("CA");
    expect(accountInitials("cam")).toBe("CA");
  });

  it("provides an account fallback when no account name is available", () => {
    expect(accountInitials("@example.com")).toBe("A");
  });
});
