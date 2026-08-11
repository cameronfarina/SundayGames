import { describe, expect, it } from "vitest";
import type { LeagueSeason } from "../src/platform/leagueSeason.js";
import {
  applySeasonKeeperCommand,
  listSeasonKeepers,
  previewSeasonKeeperCommand,
  removeSeasonKeeper,
  SeasonKeeperSetupError,
} from "../src/platform/seasonKeeperSetup.js";

const auctionSeason = {
  id: "season-2026",
  leagueId: "league-1",
  league: { id: "league-1", externalLeagueId: "1", name: "Sunday", provider: "espn" },
  seasonYear: 2026,
  setupStatus: "draft",
  teams: [
    {
      id: "team-cam",
      leagueSeasonId: "season-2026",
      ownerId: "owner-cam",
      ownerDisplayName: "Cam Farina",
      managerDisplayNames: ["Cameron Farina"],
      displayName: "Short King",
      abbreviation: "Mack",
      draftOrderPosition: 1,
    },
    {
      id: "team-beaton",
      leagueSeasonId: "season-2026",
      ownerId: "owner-beaton",
      ownerDisplayName: "Matt Beaton",
      displayName: "Dart Vader",
      draftOrderPosition: 2,
    },
  ],
  settings: {
    expectedTeamCount: 2,
    draftFormat: "auction",
    scoring: {
      passingYards: 0.04,
      passingTouchdown: 4,
      rushingYards: 0.1,
      rushingTouchdown: 6,
      receivingYards: 0.1,
      receivingTouchdown: 6,
      reception: 0.5,
    },
    auction: { budgetDollars: 200, minimumBidDollars: 1 },
    roster: {
      rosterSize: 2,
      lineup: { RB: 1, WR: 1 },
      lineupSlotCount: 2,
      rosterMaximums: { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DST: 1 },
    },
    keeperPolicy: { mode: "previous-cost-multiplier", multiplier: 1.2, rounding: "ceil" },
  },
} satisfies LeagueSeason;

const catalog = [
  { name: "De'Von Achane", position: "RB" as const, expectedPrice: 50, teamAbbreviation: "MIA" },
  { name: "Breece Hall", position: "RB" as const, expectedPrice: 40, teamAbbreviation: "NYJ" },
  { name: "Jaxson Dart", position: "QB" as const, expectedPrice: 2, teamAbbreviation: "NYG" },
  { name: "Puka Nacua", position: "WR" as const, expectedPrice: 70, teamAbbreviation: "LAR" },
];

const emptySetup = {
  seasonId: auctionSeason.id,
  sourceVersion: "current-catalog-2026",
  playerCatalog: catalog,
  initialRosters: [],
  contentHash: "old",
  updatedAt: new Date("2026-08-11T12:00:00.000Z"),
};

describe("season keeper setup", () => {
  it("previews and applies a natural auction keeper command", () => {
    const preview = previewSeasonKeeperCommand({
      season: auctionSeason,
      playerCatalog: catalog,
      command: "cam keeping achane 50",
    });

    expect(preview).toMatchObject({
      kind: "preview",
      team: { id: "team-cam", name: "Short King" },
      player: { name: "De'Von Achane", position: "RB", expectedPrice: 50 },
      keeper: { draftType: "auction", auctionCostDollars: 50 },
    });
    if (preview.kind !== "preview") throw new Error("Expected keeper preview.");

    const next = applySeasonKeeperCommand({
      season: auctionSeason,
      setup: emptySetup,
      preview,
      now: new Date("2026-08-11T13:00:00.000Z"),
    });

    expect(next.initialRosters).toEqual([{
      teamId: "team-cam",
      playerId: "devon achane",
      playerName: "De'Von Achane",
      position: "RB",
      price: 50,
      expectedPrice: 50,
      source: "keeper",
    }]);
    expect(next.sourceVersion).toBe("current-catalog-2026+keepers-v1");
  });

  it("replaces a corrected keeper for the same player and team", () => {
    const first = previewSeasonKeeperCommand({
      season: auctionSeason,
      playerCatalog: catalog,
      command: "cam keeping achane 50",
    });
    const correction = previewSeasonKeeperCommand({
      season: auctionSeason,
      playerCatalog: catalog,
      command: "cam keeping achane 48",
    });
    if (first.kind !== "preview" || correction.kind !== "preview") throw new Error("Expected previews.");

    const withKeeper = applySeasonKeeperCommand({ season: auctionSeason, setup: emptySetup, preview: first });
    const corrected = applySeasonKeeperCommand({ season: auctionSeason, setup: withKeeper, preview: correction });

    expect(listSeasonKeepers(corrected)).toHaveLength(1);
    expect(listSeasonKeepers(corrected)[0]?.price).toBe(48);
  });

  it("rejects assigning one player to two teams", () => {
    const cam = previewSeasonKeeperCommand({ season: auctionSeason, playerCatalog: catalog, command: "cam keeping achane 50" });
    const beaton = previewSeasonKeeperCommand({ season: auctionSeason, playerCatalog: catalog, command: "beaton keeping achane 45" });
    if (cam.kind !== "preview" || beaton.kind !== "preview") throw new Error("Expected previews.");
    const withCam = applySeasonKeeperCommand({ season: auctionSeason, setup: emptySetup, preview: cam });

    expect(() => applySeasonKeeperCommand({ season: auctionSeason, setup: withCam, preview: beaton }))
      .toThrowError(new SeasonKeeperSetupError(
        "keeper_player_conflict",
        "De'Von Achane is already kept by Short King.",
      ));
  });

  it("rejects an auction keeper below the minimum bid even when the preview is stale", () => {
    const preview = previewSeasonKeeperCommand({
      season: auctionSeason,
      playerCatalog: catalog,
      command: "cam keeping achane 1",
    });
    if (preview.kind !== "preview") throw new Error("Expected keeper preview.");
    const changedSeason: LeagueSeason = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        auction: { budgetDollars: 200, minimumBidDollars: 2 },
      },
    };

    expect(() => applySeasonKeeperCommand({ season: changedSeason, setup: emptySetup, preview }))
      .toThrowError(new SeasonKeeperSetupError(
        "keeper_value_invalid",
        "De'Von Achane must have a whole-dollar keeper cost of at least $2.",
      ));
  });

  it("reserves the minimum bid for every remaining auction roster slot", () => {
    const preview = previewSeasonKeeperCommand({
      season: auctionSeason,
      playerCatalog: catalog,
      command: "cam keeping achane 9",
    });
    if (preview.kind !== "preview") throw new Error("Expected keeper preview.");
    const constrainedSeason: LeagueSeason = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        auction: { budgetDollars: 10, minimumBidDollars: 2 },
      },
    };

    expect(() => applySeasonKeeperCommand({ season: constrainedSeason, setup: emptySetup, preview }))
      .toThrowError(new SeasonKeeperSetupError(
        "keeper_budget_exceeded",
        "Short King cannot keep De'Von Achane for $9 and reserve $2 for its remaining roster slot.",
      ));
  });

  it("rejects keepers beyond a team's total roster capacity", () => {
    const achane = previewSeasonKeeperCommand({
      season: auctionSeason,
      playerCatalog: catalog,
      command: "cam keeping achane 10",
    });
    const puka = previewSeasonKeeperCommand({
      season: auctionSeason,
      playerCatalog: catalog,
      command: "cam keeping nacua 10",
    });
    if (achane.kind !== "preview" || puka.kind !== "preview") throw new Error("Expected previews.");
    const onePlayerSeason: LeagueSeason = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        roster: {
          ...auctionSeason.settings.roster,
          rosterSize: 1,
          lineup: { FLEX: 1 },
          lineupSlotCount: 1,
        },
      },
    };
    const withAchane = applySeasonKeeperCommand({ season: onePlayerSeason, setup: emptySetup, preview: achane });

    expect(() => applySeasonKeeperCommand({ season: onePlayerSeason, setup: withAchane, preview: puka }))
      .toThrowError(new SeasonKeeperSetupError(
        "keeper_roster_full",
        "Short King cannot have more than 1 keeper.",
      ));
  });

  it("rejects keepers beyond a team's positional maximum", () => {
    const achane = previewSeasonKeeperCommand({
      season: auctionSeason,
      playerCatalog: catalog,
      command: "cam keeping achane 10",
    });
    const hall = previewSeasonKeeperCommand({
      season: auctionSeason,
      playerCatalog: catalog,
      command: "cam keeping hall 10",
    });
    if (achane.kind !== "preview" || hall.kind !== "preview") throw new Error("Expected previews.");
    const oneRunningBackSeason: LeagueSeason = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        roster: {
          ...auctionSeason.settings.roster,
          lineup: { FLEX: 2 },
          rosterMaximums: { ...auctionSeason.settings.roster.rosterMaximums, RB: 1 },
        },
      },
    };
    const withAchane = applySeasonKeeperCommand({ season: oneRunningBackSeason, setup: emptySetup, preview: achane });

    expect(() => applySeasonKeeperCommand({ season: oneRunningBackSeason, setup: withAchane, preview: hall }))
      .toThrowError(new SeasonKeeperSetupError(
        "keeper_position_limit",
        "Short King cannot have more than 1 RB keeper.",
      ));
  });

  it("rejects a keeper that cannot occupy any configured roster slot", () => {
    const dart = previewSeasonKeeperCommand({
      season: auctionSeason,
      playerCatalog: catalog,
      command: "cam keeping dart 10",
    });
    if (dart.kind !== "preview") throw new Error("Expected preview.");
    const receiverOnlySeason: LeagueSeason = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        roster: {
          ...auctionSeason.settings.roster,
          rosterSize: 1,
          lineup: { WR: 1 },
          lineupSlotCount: 1,
        },
      },
    };

    expect(() => applySeasonKeeperCommand({ season: receiverOnlySeason, setup: emptySetup, preview: dart }))
      .toThrowError(new SeasonKeeperSetupError(
        "keeper_position_limit",
        "Short King has no configured roster slot for Jaxson Dart.",
      ));
  });

  it("rejects a player already present in an imported initial roster", () => {
    const preview = previewSeasonKeeperCommand({
      season: auctionSeason,
      playerCatalog: catalog,
      command: "beaton keeping achane 10",
    });
    if (preview.kind !== "preview") throw new Error("Expected preview.");
    const setup = {
      ...emptySetup,
      initialRosters: [{
        teamId: "team-cam",
        playerName: "De'Von Achane",
        position: "RB" as const,
        price: 10,
        source: "imported" as const,
      }],
    };

    expect(() => applySeasonKeeperCommand({ season: auctionSeason, setup, preview }))
      .toThrowError(new SeasonKeeperSetupError(
        "keeper_player_conflict",
        "De'Von Achane is already kept by Short King.",
      ));
  });

  it("stores snake keepers by round without pretending the value is a sale price", () => {
    const snakeSeason: LeagueSeason = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        draftFormat: "snake",
        auction: undefined,
        snake: { rounds: 2, order: ["team-cam", "team-beaton"], reversal: "standard" },
        roster: {
          ...auctionSeason.settings.roster,
          lineup: { SUPERFLEX: 1, FLEX: 1 },
        },
      },
    };
    const preview = previewSeasonKeeperCommand({
      season: snakeSeason,
      playerCatalog: catalog,
      command: "beaton keeping dart 2",
    });
    if (preview.kind !== "preview") throw new Error("Expected keeper preview.");

    const next = applySeasonKeeperCommand({ season: snakeSeason, setup: emptySetup, preview });

    expect(next.initialRosters[0]).toMatchObject({
      teamId: "team-beaton",
      playerName: "Jaxson Dart",
      price: 0,
      keeperRound: 2,
    });
  });

  it("rejects stale snake previews beyond the configured round count", () => {
    const threeRoundSeason: LeagueSeason = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        draftFormat: "snake",
        auction: undefined,
        snake: { rounds: 3, order: ["team-cam", "team-beaton"], reversal: "standard" },
        roster: {
          ...auctionSeason.settings.roster,
          lineup: { SUPERFLEX: 1, FLEX: 1 },
        },
      },
    };
    const preview = previewSeasonKeeperCommand({
      season: threeRoundSeason,
      playerCatalog: catalog,
      command: "beaton keeping dart 3",
    });
    if (preview.kind !== "preview") throw new Error("Expected keeper preview.");
    const twoRoundSeason: LeagueSeason = {
      ...threeRoundSeason,
      settings: {
        ...threeRoundSeason.settings,
        snake: { ...threeRoundSeason.settings.snake, rounds: 2 },
      },
    };

    expect(() => applySeasonKeeperCommand({ season: twoRoundSeason, setup: emptySetup, preview }))
      .toThrowError(new SeasonKeeperSetupError(
        "keeper_snake_round_invalid",
        "Jaxson Dart must use a keeper round between 1 and 2.",
      ));
  });

  it("rejects two snake keepers assigned to the same team's pick", () => {
    const snakeSeason: LeagueSeason = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        draftFormat: "snake",
        auction: undefined,
        snake: { rounds: 2, order: ["team-cam", "team-beaton"], reversal: "standard" },
        roster: {
          ...auctionSeason.settings.roster,
          lineup: { SUPERFLEX: 1, FLEX: 1 },
        },
      },
    };
    const achane = previewSeasonKeeperCommand({
      season: snakeSeason,
      playerCatalog: catalog,
      command: "cam keeping achane 1",
    });
    const puka = previewSeasonKeeperCommand({
      season: snakeSeason,
      playerCatalog: catalog,
      command: "cam keeping nacua 1",
    });
    if (achane.kind !== "preview" || puka.kind !== "preview") throw new Error("Expected previews.");
    const withAchane = applySeasonKeeperCommand({ season: snakeSeason, setup: emptySetup, preview: achane });

    expect(() => applySeasonKeeperCommand({ season: snakeSeason, setup: withAchane, preview: puka }))
      .toThrowError(new SeasonKeeperSetupError(
        "keeper_snake_pick_conflict",
        "Short King already has a keeper assigned to round 1.",
      ));
  });

  it("removes only the requested team's keeper", () => {
    const preview = previewSeasonKeeperCommand({ season: auctionSeason, playerCatalog: catalog, command: "cam keeping achane 50" });
    if (preview.kind !== "preview") throw new Error("Expected preview.");
    const withKeeper = applySeasonKeeperCommand({ season: auctionSeason, setup: emptySetup, preview });

    const next = removeSeasonKeeper(withKeeper, { teamId: "team-cam", playerId: "devon achane" });

    expect(listSeasonKeepers(next)).toEqual([]);
  });
});
