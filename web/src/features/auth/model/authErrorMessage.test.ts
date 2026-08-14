import { describe, expect, it } from "vitest";
import { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import { authErrorMessage } from "./authErrorMessage";

describe("authErrorMessage", () => {
  it("preserves safe API messages and hides unknown failures", () => {
    expect(authErrorMessage(new PlatformApiError({
      code: "invalid_credentials",
      message: "Email or password is incorrect.",
      status: 401,
    }))).toBe("Email or password is incorrect.");
    expect(authErrorMessage(new Error("database details")))
      .toBe("Mockd could not complete that request.");
  });
});
