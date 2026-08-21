import { describe, expect, it } from "vitest";
import { platformLoadManifestFrom } from "../scripts/platformLoadTest/parseManifest.js";

describe("platform load manifest parsing", () => {
  it("accepts the secret-bearing load fixture shape", () => {
    expect(platformLoadManifestFrom({
      drafts: [{
        roomId: "room",
        sessionTokens: ["session"],
        mutation: {
          action: "sales",
          body: { expectedRevision: 1, sale: { playerId: "player" } },
          sessionToken: "session",
        },
      }],
      newsSessionTokens: ["news"],
      simulationRequests: [{ sessionToken: "sim", body: { count: 1 } }],
    })).toMatchObject({
      drafts: [{
        roomId: "room",
        mutation: { action: "sales", sessionToken: "session" },
      }],
    });
  });

  it("rejects malformed fixtures before starting traffic", () => {
    expect(() => platformLoadManifestFrom({ drafts: [] }))
      .toThrow("Invalid platform load-test manifest");
  });
});
