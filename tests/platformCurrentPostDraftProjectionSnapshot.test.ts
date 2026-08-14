import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { canonicalPlayerIdentityKey } from "../src/data/normalizePlayerName.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";
import {
  loadCurrentPostDraftProjectionSnapshot,
  loadLeagueScoredWeekOneProjections,
} from "../src/platform/currentPostDraftProjectionSnapshot.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../src/platform/liveDraftRooms.js";
import { loadCurrentPlayerCatalog } from "../src/platform/localDemoFixtures.js";
import { postDraftScoringSettingsIdForSeason } from "../src/platform/postDraftLiveRoomAdapter.js";
import { analyzePostDraftTeam } from "../src/platform/postDraftTeamAnalysis.js";

describe("current post-draft projection snapshots", () => {
  it("provides Week 1 projections using the selected league scoring", async () => {
    const halfPprSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    const fullPprSeason = structuredClone(halfPprSeason);
    fullPprSeason.settings.scoring.reception = 1;
    const catalog: LiveDraftRoomPlayerCatalogEntry[] = [
      { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
    ];

    const halfPpr = await loadLeagueScoredWeekOneProjections(halfPprSeason, catalog);
    const fullPpr = await loadLeagueScoredWeekOneProjections(fullPprSeason, catalog);
    const playerKey = canonicalPlayerIdentityKey("Puka Nacua");

    expect(halfPpr[playerKey]).toBeCloseTo(17.6401733628, 8);
    expect((fullPpr[playerKey] ?? 0) - (halfPpr[playerKey] ?? 0)).toBeCloseTo(
      7.346944725 * 0.5,
      8,
    );
  });

  it("leaves kicker and defense projections on the provider baseline", async () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    const projections = await loadLeagueScoredWeekOneProjections(season, [
      { name: "Brandon Aubrey", position: "K", expectedPrice: 2 },
      { name: "Broncos D/ST", position: "DST", expectedPrice: 2 },
    ]);

    expect(projections).toEqual({});
  });

  it("recomputes season points for the league scoring while preserving static source provenance", async () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    season.settings.scoring = {
      passingYards: 0.05,
      passingTouchdown: 6,
      rushingYards: 0.2,
      rushingTouchdown: 5,
      receivingYards: 0.15,
      receivingTouchdown: 7,
      reception: 1,
    };
    const catalog: LiveDraftRoomPlayerCatalogEntry[] = [
      { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
      { name: "A Made Up Player", position: "RB", expectedPrice: 12 },
    ];
    const snapshot = await loadCurrentPostDraftProjectionSnapshot(
      season,
      catalog,
      new Date("2026-08-11T12:00:00.000Z"),
    );

    expect(snapshot.metadata).toMatchObject({
      leagueId: season.leagueId,
      seasonId: season.id,
      scoringSettingsId: postDraftScoringSettingsIdForSeason(season),
      generatedAt: "2026-07-30T15:24:58.463Z",
      validThrough: "2026-07-30T15:24:58.463Z",
      source: {
        kind: "static_fallback",
        provider: "ESPN",
        datasetId: "espn-projections-2026-weeks-1-4",
        capturedAt: "2026-07-30T15:24:58.463Z",
        confidence: "low",
        weekly: false,
        scoringSpecific: true,
      },
    });
    expect(snapshot.metadata).not.toHaveProperty("week");
    expect(snapshot.projections).toHaveLength(1);
    expect(snapshot.projections.find(player => player.playerName === "Puka Nacua")).toEqual(
      expect.objectContaining({
        playerId: "player-espn-4426515",
        playerName: "Puka Nacua",
      }),
    );
    expect(snapshot.projections[0]?.seasonProjectedPoints).toBeCloseTo(
      105.6864902 * 0.2
      + 1.181059151 * 5
      + 1589.236534 * 0.15
      + 9.757497132 * 7
      + 122.8949876,
      8,
    );
    expect(snapshot.projections.find(player => player.playerName === "Puka Nacua"))
      .not.toHaveProperty("weeklyProjectedPoints");
    expect(snapshot.projections.find(player => player.playerName === "A Made Up Player")).toBeUndefined();
  });

  it("exposes recalculated weekly points only while the current week is covered", async () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    const catalog: LiveDraftRoomPlayerCatalogEntry[] = [
      { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
      { name: "De'Von Achane", position: "RB", expectedPrice: 50 },
    ];
    const snapshot = await loadCurrentPostDraftProjectionSnapshot(
      season,
      catalog,
      new Date("2026-09-08T12:00:00.000Z"),
    );

    expect(snapshot.metadata.week).toBe(1);
    expect(snapshot.metadata.source).toMatchObject({
      kind: "weekly_scoring_specific",
      weekly: true,
      scoringSpecific: true,
      confidence: "high",
    });
    expect(snapshot.projections.find(player => player.playerName === "Puka Nacua"))
      .toMatchObject({
        playerId: "player-espn-4426515",
        weeklyProjectedPoints: expect.any(Number),
      });
    expect(snapshot.projections.find(player => player.playerName === "Puka Nacua")?.weeklyProjectedPoints)
      .toBeCloseTo(
        6.140082223 * 0.1
        + 0.070110886 * 6
        + 94.47030182 * 0.1
        + 0.58083288 * 6
        + 7.346944725 * 0.5,
        8,
      );
    expect(snapshot.projections.find(player => player.playerName === "De'Von Achane")?.playerId)
      .toMatch(/^player-espn-/);
  });

  it("keys every matching catalog player to the same ESPN identity the adapter will reuse", async () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    const [catalog, espnProjections] = await Promise.all([
      loadCurrentPlayerCatalog(),
      loadEspnWeeksOneToFour("data/raw/espn-projections-2026-weeks-1-4.json"),
    ]);
    const espnByIdentity = new Map(
      espnProjections.map(projection => [canonicalPlayerIdentityKey(projection.name), projection]),
    );
    const expected = catalog.flatMap(player => {
      const projection = espnByIdentity.get(canonicalPlayerIdentityKey(player.name));
      return projection?.position === player.position && projection.seasonProjection !== undefined
        ? [{ name: player.name, playerId: `player-espn-${projection.id}` }]
        : [];
    });
    const snapshot = await loadCurrentPostDraftProjectionSnapshot(
      season,
      catalog,
      new Date("2026-09-08T12:00:00.000Z"),
    );

    expect(snapshot.projections.map(projection => ({
      name: projection.playerName,
      playerId: projection.playerId,
    }))).toEqual(expected);
    expect(new Set(snapshot.projections.map(projection => projection.playerId)).size)
      .toBe(snapshot.projections.length);
  });

  it("makes completed-draft ranking available while current recommendations stay unavailable", async () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    const catalog: LiveDraftRoomPlayerCatalogEntry[] = [
      { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
      { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
    ];
    const snapshot = await loadCurrentPostDraftProjectionSnapshot(
      season,
      catalog,
      new Date("2026-09-08T12:00:00.000Z"),
    );
    const [puka, gibbs] = snapshot.projections;
    if (puka === undefined || gibbs === undefined) throw new Error("Expected bundled player projections.");

    const analysis = analyzePostDraftTeam({
      ownership: {
        userId: "user-owner11",
        privateOwnerUserId: "user-owner11",
        leagueId: season.leagueId,
        seasonId: season.id,
        teamId: "team-owner11",
        ownerId: "owner-owner11",
      },
      evaluatedAt: new Date("2026-09-08T12:00:00.000Z"),
      currentWeek: 1,
      leagueSettings: {
        leagueId: season.leagueId,
        seasonId: season.id,
        scoring: {
          id: postDraftScoringSettingsIdForSeason(season),
          rules: { ...season.settings.scoring },
        },
        roster: {
          rosterSize: 1,
          starterSlots: [{ slot: "FLEX", eligiblePositions: ["RB", "WR", "TE"] }],
        },
      },
      completedDraftRoster: {
        snapshotId: "completed-draft",
        leagueId: season.leagueId,
        seasonId: season.id,
        capturedAt: "2026-09-01T00:00:00.000Z",
        status: "complete",
        draftFormat: "auction",
        teams: [
          {
            teamId: "team-owner11",
            ownerId: "owner-owner11",
            players: [{ playerId: puka.playerId, playerName: puka.playerName, position: puka.position }],
          },
          {
            teamId: "team-other",
            ownerId: "owner-other",
            players: [{ playerId: gibbs.playerId, playerName: gibbs.playerName, position: gibbs.position }],
          },
        ],
      },
      projectionSnapshot: snapshot,
    });

    expect(analysis.ranking.status).toBe("available");
    expect(analysis.recommendationReadiness.startSit.status).toBe("unavailable");
    expect(analysis.recommendationReadiness.pickupDrop.status).toBe("unavailable");
    expect(analysis.recommendationReadiness.startSit.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ input: "currentRoster" }),
      expect.objectContaining({ input: "weeklyProjections" }),
    ]));
    expect(analysis.recommendationReadiness.pickupDrop.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ input: "currentRoster" }),
      expect.objectContaining({ input: "freeAgents" }),
    ]));
  });
});
