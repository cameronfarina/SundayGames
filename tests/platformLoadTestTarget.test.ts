import { describe, expect, it } from "vitest";
import { platformLoadTargetFor } from "../scripts/platformLoadTest/target.js";

describe("platform load-test targets", () => {
  it.each([
    "http://127.0.0.1:4320",
    "http://localhost:4320",
    "http://[::1]:4320",
  ])("allows the loopback target %s", rawBaseUrl => {
    expect(platformLoadTargetFor(rawBaseUrl)).toMatchObject({ remote: false });
  });

  it("requires an explicit opt-in before sending load to a remote service", () => {
    expect(() => platformLoadTargetFor("https://sundaygames.io")).toThrow(
      "Refusing to load-test a remote service without --allow-remote.",
    );
    expect(platformLoadTargetFor("https://staging.example.com", true)).toMatchObject({
      remote: true,
    });
  });
});
