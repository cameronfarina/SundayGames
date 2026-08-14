import { expect, it } from "vitest";
import { errorMessage } from "./errorMessage";

it("uses error details when available", () => {
  expect(errorMessage(new Error("Detailed failure"))).toBe("Detailed failure");
  expect(errorMessage("failure")).toBe("Something went wrong. Try again.");
});
