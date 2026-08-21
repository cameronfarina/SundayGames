import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import type { LiveDraftRoomSetup } from "../src/platform/liveDraftRoomSetups.js";
import {
  createSeasonMockConfigurationSnapshot,
  normalizeSeasonMockConfigurationSnapshot,
  requireSeasonMockConfigurationSnapshot,
  seasonMockReplayConfiguration,
  seasonMockConfigurationSnapshotMaxBytes,
  SeasonMockConfigurationSnapshotError,
} from "../src/platform/seasonMockSnapshot.js";

const capturedAt = new Date("2026-08-11T15:00:00.000Z");
const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
const humanTeamId = season.teams[0]?.id ?? "missing-team";
const setup: LiveDraftRoomSetup = {
  seasonId: season.id,
  sourceVersion: "rankings-2026.1",
  playerCatalog: [
    {
      name: "Puka Nacua",
      position: "WR",
      expectedPrice: 73,
      marketPrice: 71,
      teamAbbreviation: "LAR",
      byeWeek: 8,
    },
  ],
  initialRosters: [
    {
      teamId: humanTeamId,
      playerId: "puka-nacua",
      playerName: "Puka Nacua",
      position: "WR",
      price: 50,
      expectedPrice: 69,
      source: "keeper",
    },
  ],
  contentHash: "setup-hash",
  updatedAt: new Date("2026-08-11T14:30:00.000Z"),
};

const jsonRoundTrip = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe("season mock configuration snapshots", () => {
  it("captures an immutable versioned copy of season, setup, and personalized prices", () => {
    const snapshot = createSeasonMockConfigurationSnapshot({
      season,
      setup,
      humanTeamId,
      playerExpectedPrices: {
        "puka-nacua": 69,
      },
      playerHumanValues: {
        "puka-nacua": 74,
      },
      managerProfiles: [{
        teamId: season.teams[1]?.id ?? "missing-team",
        status: "ready",
        sample: { seasonCount: 2, auctionPurchaseCount: 8, comparablePurchaseCount: 6 },
        confidence: "limited",
        targetPosition: "WR",
        targetLabel: "WR focus",
        premiumVsLeagueBaselinePercent: 14,
        starBidding: "high",
        aiTendency: {
          premiumBidMultiplier: 1.14,
          positionBidMultipliers: { WR: 1.2 },
          nominationPositionWeights: { WR: 1.2 },
        },
      }],
      capturedAt,
    });

    expect(snapshot).toMatchObject({
      status: "ready",
      schema: "mockd-season-mock",
      version: 2,
      capturedAt: capturedAt.toISOString(),
      payload: {
        season: { id: season.id },
        setup: {
          seasonId: season.id,
          updatedAt: setup.updatedAt.toISOString(),
        },
        humanTeamId,
        playerExpectedPrices: {
          "puka-nacua": 69,
        },
        playerHumanValues: {
          "puka-nacua": 74,
        },
        managerProfiles: [expect.objectContaining({
          teamId: season.teams[1]?.id,
          status: "ready",
          aiTendency: {
            premiumBidMultiplier: 1.14,
            positionBidMultipliers: { WR: 1.2 },
            nominationPositionWeights: { WR: 1.2 },
          },
        })],
      },
    });
    expect(snapshot.payload.season).not.toBe(season);
    expect(snapshot.payload.setup).not.toBe(setup);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.payload.setup.playerCatalog)).toBe(true);

    const decoded = normalizeSeasonMockConfigurationSnapshot(jsonRoundTrip(snapshot));

    expect(decoded).toEqual(snapshot);
    expect(requireSeasonMockConfigurationSnapshot(decoded)).toBe(decoded);
    expect(seasonMockReplayConfiguration(decoded)).toMatchObject({
      season: { id: season.id },
      setup: {
        seasonId: season.id,
        updatedAt: setup.updatedAt,
      },
      humanTeamId,
      playerExpectedPrices: { "puka-nacua": 69 },
      playerHumanValues: { "puka-nacua": 74 },
      managerProfiles: [expect.objectContaining({ teamId: season.teams[1]?.id })],
    });
  });

  it("defaults additive manager profiles for snapshots created by an older server", () => {
    const snapshot = createSeasonMockConfigurationSnapshot({
      season, setup, humanTeamId, playerExpectedPrices: {}, capturedAt,
    });
    const { managerProfiles: _managerProfiles, ...legacyPayload } = snapshot.payload;
    const legacyShape = { ...snapshot, payload: legacyPayload };

    const decoded = normalizeSeasonMockConfigurationSnapshot(legacyShape);

    expect(decoded.status).toBe("ready");
    if (decoded.status === "ready") expect(decoded.payload.managerProfiles).toEqual([]);
  });

  it("rejects manager profiles whose displayed tendency contradicts the replay tendency", () => {
    const snapshot = jsonRoundTrip(createSeasonMockConfigurationSnapshot({
      season,
      setup,
      humanTeamId,
      playerExpectedPrices: {},
      managerProfiles: [{
        teamId: season.teams[1]?.id ?? "missing-team",
        status: "ready",
        sample: { seasonCount: 2, auctionPurchaseCount: 8, comparablePurchaseCount: 6 },
        confidence: "limited",
        targetPosition: "RB",
        targetLabel: "RB focus",
        premiumVsLeagueBaselinePercent: 14,
        starBidding: "low",
        aiTendency: {
          premiumBidMultiplier: 0.4,
          positionBidMultipliers: { RB: 1.2 },
          nominationPositionWeights: { RB: 1.2 },
        },
      }],
      capturedAt,
    })) as { payload: { managerProfiles: Array<Record<string, unknown>> } };
    const profile = snapshot.payload.managerProfiles[0];
    if (profile === undefined) throw new Error("Expected a manager profile.");
    profile.targetPosition = "WR";
    profile.targetLabel = "WR focus";
    profile.starBidding = "high";

    expect(() => normalizeSeasonMockConfigurationSnapshot(snapshot)).toThrow(
      new SeasonMockConfigurationSnapshotError(
        "snapshot_malformed",
        "Mock draft configuration snapshot is malformed.",
      ),
    );
  });

  it("rejects profile metrics that do not meet the canonical evidence thresholds", () => {
    const snapshot = createSeasonMockConfigurationSnapshot({
      season,
      setup,
      humanTeamId,
      playerExpectedPrices: {},
      managerProfiles: [{
        teamId: season.teams[1]?.id ?? "missing-team",
        status: "ready",
        sample: { seasonCount: 2, auctionPurchaseCount: 8, comparablePurchaseCount: 0 },
        confidence: "limited",
        targetPosition: "WR",
        targetLabel: "WR focus",
        premiumVsLeagueBaselinePercent: null,
        starBidding: "typical",
        aiTendency: {
          premiumBidMultiplier: 1,
          positionBidMultipliers: { WR: 1.15 },
          nominationPositionWeights: { WR: 1.15 },
        },
      }],
      capturedAt,
    });
    const weakFocus = jsonRoundTrip(snapshot) as {
      payload: { managerProfiles: Array<{ aiTendency: {
        positionBidMultipliers: Record<string, number>;
        nominationPositionWeights: Record<string, number>;
      }; premiumVsLeagueBaselinePercent: number | null }> };
    };
    const profile = weakFocus.payload.managerProfiles[0];
    if (profile === undefined) throw new Error("Expected a manager profile.");
    profile.aiTendency.positionBidMultipliers.WR = 1;
    profile.aiTendency.nominationPositionWeights.WR = 1;
    expect(() => normalizeSeasonMockConfigurationSnapshot(weakFocus)).toThrow(
      SeasonMockConfigurationSnapshotError,
    );

    const unsupportedPremium = jsonRoundTrip(snapshot) as typeof weakFocus;
    const premiumProfile = unsupportedPremium.payload.managerProfiles[0];
    if (premiumProfile === undefined) throw new Error("Expected a manager profile.");
    premiumProfile.premiumVsLeagueBaselinePercent = 12;
    expect(() => normalizeSeasonMockConfigurationSnapshot(unsupportedPremium)).toThrow(
      SeasonMockConfigurationSnapshotError,
    );
  });

  it("returns explicit migration outcomes for legacy and unsupported snapshot versions", () => {
    expect(normalizeSeasonMockConfigurationSnapshot(undefined)).toEqual({
      status: "migration-required",
      schema: "mockd-season-mock",
      reason: "missing-snapshot",
    });
    expect(normalizeSeasonMockConfigurationSnapshot({
      status: "ready",
      schema: "mockd-season-mock",
      version: 1,
      payload: {},
    })).toEqual({
      status: "migration-required",
      schema: "mockd-season-mock",
      reason: "unsupported-version",
      sourceVersion: 1,
    });
    expect(() => requireSeasonMockConfigurationSnapshot({
      status: "migration-required",
      schema: "mockd-season-mock",
      reason: "missing-snapshot",
    })).toThrow(new SeasonMockConfigurationSnapshotError(
      "snapshot_migration_required",
      "This mock draft predates immutable configuration snapshots and must be restarted.",
    ));
    expect(() => requireSeasonMockConfigurationSnapshot({
      status: "migration-required",
      schema: "mockd-season-mock",
      reason: "unsupported-version",
      sourceVersion: 7,
    })).toThrow(new SeasonMockConfigurationSnapshotError(
      "snapshot_migration_required",
      "This mock draft uses unsupported configuration snapshot version 7 and must be migrated.",
    ));
  });

  it("isolates private replay inputs and defaults human values without retaining references", () => {
    const expectedPrices = { "puka-nacua": 69 };
    const snapshot = createSeasonMockConfigurationSnapshot({
      season,
      setup,
      humanTeamId,
      playerExpectedPrices: expectedPrices,
      capturedAt,
    });

    expectedPrices["puka-nacua"] = 1;
    expect(snapshot.payload.playerExpectedPrices).toEqual({ "puka-nacua": 69 });
    expect(snapshot.payload.playerHumanValues).toEqual({ "puka-nacua": 69 });
    expect(snapshot.payload.setup.playerCatalog[0]?.name).toBe("Puka Nacua");
    expect(Object.isFrozen(snapshot.payload.playerExpectedPrices)).toBe(true);
    expect(Object.isFrozen(snapshot.payload.playerHumanValues)).toBe(true);
  });

  it("rejects cross-season and unknown-team relationships", () => {
    const malformedError = new SeasonMockConfigurationSnapshotError(
      "snapshot_malformed",
      "Mock draft configuration snapshot is malformed.",
    );
    expect(() => createSeasonMockConfigurationSnapshot({
      season,
      setup,
      humanTeamId: "missing-team",
      playerExpectedPrices: {},
      capturedAt,
    })).toThrow(malformedError);
    expect(() => createSeasonMockConfigurationSnapshot({
      season,
      setup: { ...setup, seasonId: "other-season" },
      humanTeamId,
      playerExpectedPrices: {},
      capturedAt,
    })).toThrow(malformedError);
    expect(() => createSeasonMockConfigurationSnapshot({
      season,
      setup: {
        ...setup,
        initialRosters: [{
          teamId: "missing-team",
          playerId: "puka-nacua",
          playerName: "Puka Nacua",
          position: "WR",
          price: 50,
          expectedPrice: 69,
          source: "keeper",
        }],
      },
      humanTeamId,
      playerExpectedPrices: {},
      capturedAt,
    })).toThrow(malformedError);
  });

  it("rejects malformed and oversized snapshots before they reach persistence", () => {
    expect(() => normalizeSeasonMockConfigurationSnapshot({
      status: "ready",
      schema: "mockd-season-mock",
      version: 2,
      capturedAt: "not-a-date",
      payload: {},
    })).toThrow(new SeasonMockConfigurationSnapshotError(
      "snapshot_malformed",
      "Mock draft configuration snapshot is malformed.",
    ));

    expect(() => createSeasonMockConfigurationSnapshot({
      season,
      setup: {
        ...setup,
        sourceVersion: "x".repeat(seasonMockConfigurationSnapshotMaxBytes),
      },
      humanTeamId,
      playerExpectedPrices: {},
      capturedAt,
    })).toThrow(new SeasonMockConfigurationSnapshotError(
      "snapshot_too_large",
      "Mock draft configuration snapshot exceeds the 2 MiB storage limit.",
    ));
  });
});
