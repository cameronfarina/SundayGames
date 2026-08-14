import { describe, expect, it } from "vitest";
import { liveDraftErrorMessage } from "./liveDraftError";

describe("liveDraftErrorMessage", () => {
  it("uses Error messages and a safe fallback for unknown failures", () => {
    expect(liveDraftErrorMessage(new Error("Room failed"))).toBe("Room failed");
    expect(liveDraftErrorMessage("failed")).toBe("The draft action failed. Try again.");
  });
});
