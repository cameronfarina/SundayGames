import { describe, expect, it } from "vitest";
import { accountInitials } from "./accountInitials";

describe("accountInitials", () => {
  it("uses the first two account-name segments", () => {
    expect(accountInitials("example.user@example.com")).toBe("EU");
    expect(accountInitials("user@example.com")).toBe("US");
    expect(accountInitials("owner11")).toBe("OW");
  });

  it("provides an account fallback when no account name is available", () => {
    expect(accountInitials("@example.com")).toBe("A");
  });
});
