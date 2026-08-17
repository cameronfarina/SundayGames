import { describe, expect, it } from "vitest";
import { accountInitial } from "./accountInitial";

describe("accountInitial", () => {
  it("uses the first letter of the account name", () => {
    expect(accountInitial("example.user@example.com")).toBe("E");
    expect(accountInitial("user@example.com")).toBe("U");
    expect(accountInitial("owner11")).toBe("O");
  });

  it("skips separators that start the account name", () => {
    expect(accountInitial("_hidden.user@example.com")).toBe("H");
  });

  it("provides an account fallback when no account name is available", () => {
    expect(accountInitial("@example.com")).toBe("A");
  });
});
