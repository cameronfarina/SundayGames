import { describe, expect, it } from "vitest";
import { platformLoadCliConfigFrom } from "../scripts/platformLoadTest/cliConfig.js";

describe("platform load-test CLI config", () => {
  it("parses the 30- and 50-league scenarios", () => {
    expect(platformLoadCliConfigFrom([
      "--target=http://127.0.0.1:10000",
      "--manifest=/tmp/load.json",
      "--leagues=50",
      "--hold-seconds=45",
      "--allow-remote",
    ])).toEqual({
      allowRemote: true,
      holdMs: 45_000,
      leagueCount: 50,
      manifestPath: "/tmp/load.json",
      target: "http://127.0.0.1:10000",
    });
  });

  it("defaults to the safer 30-league local scenario", () => {
    expect(platformLoadCliConfigFrom([
      "--target=http://127.0.0.1:10000",
      "--manifest=/tmp/load.json",
    ])).toMatchObject({ allowRemote: false, holdMs: 30_000, leagueCount: 30 });
  });

  it("rejects unsupported league counts", () => {
    expect(() => platformLoadCliConfigFrom([
      "--target=http://127.0.0.1:10000",
      "--manifest=/tmp/load.json",
      "--leagues=40",
    ])).toThrow("--leagues must be either 30 or 50");
  });
});
