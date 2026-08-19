import { describe, expect, it } from "vitest";
import { liveDraftAdvisorySchema } from "./liveDraftAdvisorySchemas";

describe("liveDraftAdvisorySchema", () => {
  it("accepts a player carrying every optional field", () => {
    const parsed = liveDraftAdvisorySchema.parse({
      configured: true,
      basis: "ros",
      week: 4,
      players: [{
        normalizedPlayerName: "Puka Nacua",
        rankEcr: 3,
        tier: 1,
        positionRank: "WR2",
        momentum: "rising",
        ecrDelta: 4,
      }],
    });

    expect(parsed.players[0]).toMatchObject({ momentum: "rising", rankEcr: 3, tier: 1 });
  });

  it("accepts a dark advisory with a null week and no players", () => {
    const parsed = liveDraftAdvisorySchema.parse({
      configured: false,
      basis: "ros",
      week: null,
      players: [],
    });

    expect(parsed).toEqual({ configured: false, basis: "ros", week: null, players: [] });
  });

  it("accepts a player missing every optional field", () => {
    const parsed = liveDraftAdvisorySchema.parse({
      configured: true,
      basis: "weekly",
      week: 7,
      players: [{ normalizedPlayerName: "Jahmyr Gibbs", rankEcr: 2, momentum: "steady" }],
    });

    expect(parsed.players[0]).toEqual({
      normalizedPlayerName: "Jahmyr Gibbs",
      rankEcr: 2,
      momentum: "steady",
    });
  });

  it("accepts an injury report riding along with a player", () => {
    const parsed = liveDraftAdvisorySchema.parse({
      configured: true,
      basis: "ros",
      week: 4,
      players: [{
        normalizedPlayerName: "Jahmyr Gibbs",
        rankEcr: 2,
        momentum: "steady",
        injury: {
          headline: "Gibbs is limited with an ankle injury",
          publishedAt: "2026-09-17T08:30:00.000Z",
        },
      }],
    });

    expect(parsed.players[0]?.injury).toEqual({
      headline: "Gibbs is limited with an ankle injury",
      publishedAt: "2026-09-17T08:30:00.000Z",
    });
  });

  it("rejects an injury report with no headline", () => {
    expect(liveDraftAdvisorySchema.safeParse({
      configured: true,
      basis: "ros",
      week: 1,
      players: [{
        normalizedPlayerName: "Nobody",
        rankEcr: 1,
        momentum: "steady",
        injury: { headline: "", publishedAt: "2026-09-17T08:30:00.000Z" },
      }],
    }).success).toBe(false);
  });

  it("rejects an unknown momentum", () => {
    expect(liveDraftAdvisorySchema.safeParse({
      configured: true,
      basis: "ros",
      week: 1,
      players: [{ normalizedPlayerName: "Nobody", rankEcr: 1, momentum: "sideways" }],
    }).success).toBe(false);
  });

  it("rejects a non-positive rank", () => {
    expect(liveDraftAdvisorySchema.safeParse({
      configured: true,
      basis: "ros",
      week: 1,
      players: [{ normalizedPlayerName: "Nobody", rankEcr: 0, momentum: "steady" }],
    }).success).toBe(false);
  });
});
