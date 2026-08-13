import { describe, expect, it } from "vitest";

import { canonicalPlayerIdentityKey } from "../src/data/normalizePlayerName.js";
import type {
  AuctionLeagueSeasonSettings,
  LeagueSeason,
  SnakeLeagueSeasonSettings,
} from "../src/platform/leagueSeason.js";
import type { LiveDraftRoomSetup } from "../src/platform/liveDraftRoomSetups.js";
import {
  parseSeasonSimulationStrategy,
  runSeasonSimulations,
  SeasonSimulationError,
} from "../src/platform/seasonSimulationEngine.js";

const teams = ["Cam", "Sam", "Matt", "Nick"].map((name, index) => ({
  id: `team-${index + 1}`,
  leagueSeasonId: "season-2026",
  ownerId: `owner-${index + 1}`,
  ownerDisplayName: name,
  displayName: `${name} Team`,
  draftOrderPosition: index + 1,
}));

const commonSeason = {
  id: "season-2026",
  leagueId: "league-1",
  league: { id: "league-1", externalLeagueId: "1", name: "Sunday", provider: "espn" as const },
  seasonYear: 2026,
  setupStatus: "published" as const,
  teams,
};

const scoring = {
  passingYards: 0.04,
  passingTouchdown: 4,
  rushingYards: 0.1,
  rushingTouchdown: 6,
  receivingYards: 0.1,
  receivingTouchdown: 6,
  reception: 0.5,
};

const keeperPolicy = {
  mode: "previous-cost-multiplier" as const,
  multiplier: 1.2,
  rounding: "ceil" as const,
};

const auctionSeason: LeagueSeason<AuctionLeagueSeasonSettings> = {
  ...commonSeason,
  settings: {
    expectedTeamCount: 4,
    draftFormat: "auction",
    scoring,
    auction: { budgetDollars: 50, minimumBidDollars: 1 },
    roster: {
      rosterSize: 2,
      lineup: { RB: 1, FLEX: 1 },
      lineupSlotCount: 2,
      rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 1, DST: 1 },
    },
    keeperPolicy,
  },
};

const auctionSetup: LiveDraftRoomSetup = {
  seasonId: auctionSeason.id,
  sourceVersion: "test",
  playerCatalog: [
    { name: "Elite Runner", position: "RB", expectedPrice: 45 },
    { name: "Elite Receiver", position: "WR", expectedPrice: 40 },
    { name: "De'Von Achane", position: "RB", expectedPrice: 30, week1Projection: 18.5 },
    { name: "Jadarian Price", position: "RB", expectedPrice: 10, week1Projection: 9.4 },
    { name: "Runner Two", position: "RB", expectedPrice: 22 },
    { name: "Runner Three", position: "RB", expectedPrice: 18 },
    { name: "Runner Four", position: "RB", expectedPrice: 14 },
    { name: "Runner Five", position: "RB", expectedPrice: 6 },
    { name: "Receiver One", position: "WR", expectedPrice: 20 },
    { name: "Receiver Two", position: "WR", expectedPrice: 16 },
    { name: "Receiver Three", position: "WR", expectedPrice: 12 },
    { name: "Receiver Four", position: "WR", expectedPrice: 8 },
    { name: "Receiver Five", position: "WR", expectedPrice: 4 },
  ],
  initialRosters: [{
    teamId: "team-1",
    playerId: "devon achane",
    playerName: "De'Von Achane",
    position: "RB",
    price: 30,
    source: "keeper",
  }],
  contentHash: "auction-hash",
  updatedAt: new Date("2026-08-11T12:00:00.000Z"),
};

const snakeSeason: LeagueSeason<SnakeLeagueSeasonSettings> = {
  ...commonSeason,
  settings: {
    expectedTeamCount: 4,
    draftFormat: "snake",
    scoring,
    snake: {
      rounds: 2,
      order: teams.map(team => team.id),
      reversal: "standard",
    },
    roster: {
      rosterSize: 2,
      lineup: { RB: 1, FLEX: 1 },
      lineupSlotCount: 2,
      rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 1, DST: 1 },
    },
    keeperPolicy,
  },
};

const snakeSetup: LiveDraftRoomSetup = {
  seasonId: snakeSeason.id,
  sourceVersion: "test",
  playerCatalog: [
    { name: "De'Von Achane", position: "RB", expectedPrice: 30 },
    { name: "Target Receiver", position: "WR", expectedPrice: 25 },
    { name: "Runner Two", position: "RB", expectedPrice: 20 },
    { name: "Runner Three", position: "RB", expectedPrice: 19 },
    { name: "Runner Four", position: "RB", expectedPrice: 18 },
    { name: "Receiver Two", position: "WR", expectedPrice: 17 },
    { name: "Receiver Three", position: "WR", expectedPrice: 16 },
    { name: "Receiver Four", position: "WR", expectedPrice: 15 },
  ],
  initialRosters: [{
    teamId: "team-1",
    playerId: "devon achane",
    playerName: "De'Von Achane",
    position: "RB",
    price: 0,
    keeperRound: 2,
    source: "keeper",
  }],
  contentHash: "snake-hash",
  updatedAt: new Date("2026-08-11T12:00:00.000Z"),
};

describe("season simulation strategy parser", () => {
  it("parses a cap for untargeted players at a position", () => {
    const strategy = parseSeasonSimulationStrategy(
      "draft Ladd for no more than $25. Do not spend over $25 on another WR.",
    );

    expect(strategy).toMatchObject({
      targets: [{ playerName: "Ladd", maxAuctionPrice: 25 }],
      positionCaps: [{ position: "WR", maxAuctionPrice: 25, excludeNamedTargets: true }],
      summary: "Target Ladd up to $25; cap other WRs at $25.",
      warnings: [],
    });
  });

  it("parses the complete multi-target strategy used by the Practice UI", () => {
    const strategy = parseSeasonSimulationStrategy(
      "draft jadarian price for under $20, draft gibbs for no more than $78. Draft kyler murray for no more than $2. draft ladd for no more than $25 draft. do not spend over $25 on another WR.",
    );

    expect(strategy).toMatchObject({
      targets: [
        { playerName: "jadarian price", maxAuctionPrice: 19 },
        { playerName: "gibbs", maxAuctionPrice: 78 },
        { playerName: "kyler murray", maxAuctionPrice: 2 },
        { playerName: "ladd", maxAuctionPrice: 25 },
      ],
      positionCaps: [{ position: "WR", maxAuctionPrice: 25, excludeNamedTargets: true }],
      summary: "Target jadarian price up to $19; target gibbs up to $78; target kyler murray up to $2; target ladd up to $25; cap other WRs at $25.",
      warnings: [],
    });
  });

  it("parses multiple named auction targets with independent price caps", () => {
    const strategy = parseSeasonSimulationStrategy(
      "draft jadarian price for no more than $20. Draft gibbs for no more than $76",
    );

    expect(strategy).toMatchObject({
      targets: [
        { playerName: "jadarian price", maxAuctionPrice: 20 },
        { playerName: "gibbs", maxAuctionPrice: 76 },
      ],
      summary: "Target jadarian price up to $20; target gibbs up to $76.",
      warnings: [],
    });
  });

  it.each([
    {
      input: "draft Gibbs by pick 5 and draft Chase by round 2",
      targets: [
        { playerName: "Gibbs", maxSnakeOverallPick: 5 },
        { playerName: "Chase", maxSnakeRound: 2 },
      ],
    },
    {
      input: "draft Gibbs and draft Chase under $74",
      targets: [
        { playerName: "Gibbs" },
        { playerName: "Chase", maxAuctionPrice: 73 },
      ],
    },
    {
      input: "target Gibbs and target Chase",
      targets: [{ playerName: "Gibbs" }, { playerName: "Chase" }],
    },
    {
      input: "target Gibbs; target Chase under $70",
      targets: [
        { playerName: "Gibbs" },
        { playerName: "Chase", maxAuctionPrice: 69 },
      ],
    },
    {
      input: "target Gibbs, target Chase under $70",
      targets: [
        { playerName: "Gibbs" },
        { playerName: "Chase", maxAuctionPrice: 69 },
      ],
    },
  ])("keeps separate target clauses in source order: $input", ({ input, targets }) => {
    expect(parseSeasonSimulationStrategy(input)).toMatchObject({ targets, warnings: [] });
  });

  it("reports only the auction target, preferred position, and pairing it can honor", () => {
    const strategy = parseSeasonSimulationStrategy(
      "Run 25 simulations where I draft Jadarian Price for no more than $20 and target an elite RB to pair with Achane",
    );

    expect(strategy).toEqual({
      rawInput: "Run 25 simulations where I draft Jadarian Price for no more than $20 and target an elite RB to pair with Achane",
      target: {
        playerName: "Jadarian Price",
        maxAuctionPrice: 20,
      },
      targets: [{
        playerName: "Jadarian Price",
        maxAuctionPrice: 20,
      }],
      preferredPositions: [{ position: "RB", tier: "elite" }],
      pairWithPlayerName: "Achane",
      summary: "Target Jadarian Price up to $20; prioritize elite RB; pair with Achane.",
      warnings: [],
    });
  });

  it("parses snake deadlines and warns about strategy language it does not support", () => {
    expect(parseSeasonSimulationStrategy("Draft Ja'Marr Chase no later than round 3"))
      .toMatchObject({
        target: { playerName: "Ja'Marr Chase", maxSnakeRound: 3 },
        summary: "Target Ja'Marr Chase by round 3.",
        warnings: [],
      });
    expect(parseSeasonSimulationStrategy("Draft Puka Nacua by pick 18 and avoid week 6 byes"))
      .toMatchObject({
        target: { playerName: "Puka Nacua", maxSnakeOverallPick: 18 },
        warnings: ["Unsupported strategy phrase: \"avoid week 6 byes\"."],
      });
  });

  it("parses a named target without inventing a price or pick constraint", () => {
    expect(parseSeasonSimulationStrategy("Target CeeDee Lamb"))
      .toMatchObject({
        target: { playerName: "CeeDee Lamb" },
        summary: "Target CeeDee Lamb.",
        warnings: [],
      });
  });

  it("parses a counted position target with an auction cap", () => {
    expect(parseSeasonSimulationStrategy(
      "Run 100 simulations where I draft 2 elite RBs for no more than $70 each",
    )).toMatchObject({
      preferredPositions: [{
        position: "RB",
        tier: "elite",
        targetCount: 2,
        maxAuctionPrice: 70,
      }],
      summary: "Prioritize 2 elite RB up to $70 each.",
      warnings: [],
    });
  });
});

describe("season simulation runner", () => {
  it("reports each completed league draft while a simulation batch runs", () => {
    const progress: Array<{ completed: number; total: number }> = [];

    runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 3,
      strategyInput: "",
      seedPrefix: "progress-events",
    }, {
      onProgress: update => progress.push(update),
    });

    expect(progress).toEqual([
      { completed: 1, total: 3 },
      { completed: 2, total: 3 },
      { completed: 3, total: 3 },
    ]);
  });

  it("scores the best legal Week 1 lineup instead of the draft-time slot assignment", () => {
    const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        roster: {
          ...auctionSeason.settings.roster,
          lineup: { RB: 1, BENCH: 1 },
          lineupSlotCount: 1,
        },
      },
    };
    const result = runSeasonSimulations({
      season,
      setup: {
        ...auctionSetup,
        initialRosters: [
          ...auctionSetup.initialRosters,
          {
            teamId: "team-1",
            playerId: "jadarian price",
            playerName: "Jadarian Price",
            position: "RB",
            price: 10,
            source: "keeper",
          },
        ],
      },
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Draft Jadarian Price for no more than $20",
      week1Projections: {
        "devon achane": 1,
        "jadarian price": 50,
      },
      seedPrefix: "optimal-lineup",
    });
    const team = result.runs[0]?.teams.find(candidate => candidate.teamId === "team-1");

    expect(team?.week1Points).toBe(50);
    expect(team?.roster.find(player => player.playerName === "Jadarian Price"))
      .toMatchObject({ rosterSlot: "RB", starter: true, week1Points: 50 });
    expect(team?.roster.find(player => player.playerName === "De'Von Achane"))
      .toMatchObject({ rosterSlot: "BENCH", starter: false, week1Points: 1 });
  });

  it("completes deterministic auction runs with keepers, a price-capped target, and exposure", () => {
    const input = {
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 3,
      strategyInput: "Draft Jadarian Price for no more than $20 and target an elite RB to pair with Achane",
      seedPrefix: "auction-plan",
    };

    const result = runSeasonSimulations(input);

    expect(result).toMatchObject({
      draftFormat: "auction",
      runCount: 3,
      completedCount: 3,
      seedPrefix: "auction-plan",
      targetOutcome: {
        playerName: "Jadarian Price",
        hitCount: 3,
        hitRate: 1,
      },
      positionCounts: {
        RB: { total: 6, perRun: 2 },
      },
    });
    expect(result.playerExposure.find(player => player.playerName === "Jadarian Price"))
      .toMatchObject({ count: 3, rate: 1, averagePrice: expect.any(Number) });
    expect(result.playerExposure.find(player => player.playerName === "Jadarian Price")?.averagePrice)
      .toBeLessThanOrEqual(20);
    expect(result.strategy.warnings).not.toContain(
      "Pair-with player Achane was not found in the player catalog.",
    );
    expect(result.runs).toHaveLength(3);
    expect(result.runs[0]).toMatchObject({
      runNumber: 1,
      label: "Run 1",
      seed: "auction-plan:1",
    });
    expect(result.runs[0]?.teams).toHaveLength(4);
    expect(result.runs[0]?.teams.find(team => team.teamId === "team-1")).toMatchObject({
      teamName: "Cam Team",
      isUserTeam: true,
      roster: expect.arrayContaining([
        expect.objectContaining({
          playerName: "De'Von Achane",
          source: "keeper",
          week1Points: 18.5,
        }),
      ]),
    });
    expect(result.runs[0]?.teams.every(team => team.roster.length === 2)).toBe(true);
    expect(runSeasonSimulations(input)).toEqual(result);
  });

  it("resolves a uniquely abbreviated player token without losing punctuation in the catalog name", () => {
    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: {
        ...auctionSetup,
        playerCatalog: [
          ...auctionSetup.playerCatalog,
          { name: "Ja'Marr Chase", position: "WR", expectedPrice: 40 },
        ],
        initialRosters: [{
          teamId: "team-1",
          playerId: "jamarr chase",
          playerName: "Ja'Marr Chase",
          position: "WR",
          price: 20,
          source: "keeper",
        }],
      },
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "draft jamar chase",
      seedPrefix: "player-token-abbreviation",
    });

    expect(result.strategy.warnings).toEqual([]);
    expect(result.targetOutcome).toMatchObject({
      playerName: "Ja'Marr Chase",
      hitCount: 1,
      hitRate: 1,
    });
  });

  it("drafts an uncapped saved target before spending its position and budget elsewhere", () => {
    const largeTeams = Array.from({ length: 14 }, (_, index) => ({
      id: `large-team-${index + 1}`,
      leagueSeasonId: "season-2026",
      ownerId: `large-owner-${index + 1}`,
      ownerDisplayName: `Owner ${index + 1}`,
      displayName: `Team ${index + 1}`,
      draftOrderPosition: index + 1,
    }));
    const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...auctionSeason,
      teams: largeTeams,
      settings: {
        ...auctionSeason.settings,
        expectedTeamCount: largeTeams.length,
        auction: { budgetDollars: 100, minimumBidDollars: 1 },
        roster: {
          rosterSize: 2,
          lineup: { QB: 1, BENCH: 1 },
          lineupSlotCount: 1,
          rosterMaximums: { QB: 2, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
        },
      },
    };
    const setup: LiveDraftRoomSetup = {
      ...auctionSetup,
      initialRosters: [],
      playerCatalog: [
        { name: "Jared Goff", position: "QB", expectedPrice: 1, week1Projection: 16 },
        ...Array.from({ length: 27 }, (_, index) => ({
          name: index === 0 ? "Josh Allen" : `Quarterback ${index + 2}`,
          position: "QB" as const,
          expectedPrice: Math.max(1, 30 - index),
          week1Projection: 30 - index * 0.25,
        })),
      ],
    };

    const result = runSeasonSimulations({
      season,
      setup,
      humanTeamId: largeTeams.at(-1)?.id ?? "large-team-14",
      runCount: 3,
      targetConstraints: [{ playerName: "Jared Goff" }],
      seedPrefix: "saved-mandatory-quarterback-target",
    });

    expect(result.targetOutcome).toMatchObject({
      playerName: "Jared Goff",
      hitCount: 3,
      hitRate: 1,
    });
    for (const run of result.runs) {
      const roster = run.teams.find(team => team.isUserTeam)?.roster ?? [];
      expect(roster).toEqual(expect.arrayContaining([
        expect.objectContaining({ playerName: "Jared Goff" }),
      ]));
    }
  });

  it("drafts every feasible uncapped target in a production-sized auction plan", () => {
    const largeTeams = Array.from({ length: 14 }, (_, index) => ({
      id: `large-team-${index + 1}`,
      leagueSeasonId: "season-2026",
      ownerId: `large-owner-${index + 1}`,
      ownerDisplayName: `Owner ${index + 1}`,
      displayName: `Team ${index + 1}`,
      draftOrderPosition: index + 1,
    }));
    const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...auctionSeason,
      teams: largeTeams,
      settings: {
        ...auctionSeason.settings,
        expectedTeamCount: largeTeams.length,
        auction: { budgetDollars: 200, minimumBidDollars: 1 },
        roster: {
          rosterSize: 16,
          lineup: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, DST: 1, K: 1, BENCH: 7 },
          lineupSlotCount: 9,
          rosterMaximums: { QB: 8, RB: 10, WR: 10, TE: 8, K: 8, DST: 8 },
        },
      },
    };
    const targets = [
      { name: "Jadarian Price", position: "RB" as const, expectedPrice: 14, week1Projection: 12.9 },
      { name: "Ja'Marr Chase", position: "WR" as const, expectedPrice: 74, week1Projection: 17 },
      { name: "Jared Goff", position: "QB" as const, expectedPrice: 1, week1Projection: 18 },
      { name: "Jaylen Warren", position: "RB" as const, expectedPrice: 12, week1Projection: 11.2 },
      { name: "Ladd McConkey", position: "WR" as const, expectedPrice: 23, week1Projection: 11.4 },
    ];
    const depthPlayers = ([
      ["QB", 28],
      ["RB", 84],
      ["WR", 84],
      ["TE", 28],
      ["K", 28],
      ["DST", 28],
    ] as const).flatMap(([position, count]) => Array.from({ length: count }, (_, index) => ({
      name: `Depth ${position} ${index + 1}`,
      position,
      expectedPrice: Math.max(1, 35 - index),
      week1Projection: Math.max(1, 20 - index * 0.2),
    })));
    const setup: LiveDraftRoomSetup = {
      ...auctionSetup,
      initialRosters: [{
        teamId: "large-team-7",
        playerId: "devonta smith",
        playerName: "DeVonta Smith",
        position: "WR",
        price: 24,
        source: "keeper",
      }],
      playerCatalog: [
        ...targets,
        { name: "DeVonta Smith", position: "WR", expectedPrice: 24, week1Projection: 12.1 },
        ...depthPlayers,
      ],
    };
    const targetHumanValues: Readonly<Record<string, number>> = {
      "jadarian price": 15,
      "jamarr chase": 81,
      "jared goff": 1,
      "jaylen warren": 13,
      "ladd mcconkey": 25,
    };
    const playerHumanValues = Object.fromEntries(setup.playerCatalog.map(player => [
      canonicalPlayerIdentityKey(player.name),
      targetHumanValues[canonicalPlayerIdentityKey(player.name)] ?? player.expectedPrice + 5,
    ]));

    const result = runSeasonSimulations({
      season,
      setup,
      humanTeamId: "large-team-7",
      runCount: 3,
      strategyInput: "draft jadarian price. draft Ja'Marr chase. draft jared goff. draft jaylen warren. draft ladd.",
      playerHumanValues,
      seedPrefix: "production-five-target-plan",
    });

    expect(result.strategy.warnings).toEqual([]);
    expect(result.targetOutcomes?.map(outcome => ({
      playerName: outcome.playerName,
      hitCount: outcome.hitCount,
    }))).toEqual(targets.map(target => ({ playerName: target.name, hitCount: 3 })));
    for (const run of result.runs) {
      const humanTeam = run.teams.find(team => team.isUserTeam);
      expect(humanTeam?.roster.filter(player =>
        targets.some(target => target.name === player.playerName)
      )).toHaveLength(targets.length);
      expect(humanTeam?.roster).toHaveLength(season.settings.roster.rosterSize);
      expect(humanTeam?.budgetRemaining).toBe(0);
      expect(run.teams.every(team => team.roster.length === season.settings.roster.rosterSize))
        .toBe(true);
      expect(run.teams.every(team => team.budgetRemaining === 0)).toBe(true);
    }
  });

  it("keeps a saved target authoritative when additional strategy names the same player", () => {
    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-2",
      runCount: 1,
      targetConstraints: [{ playerName: "Jadarian Price", maxAuctionPrice: 12 }],
      strategyInput: "draft jadarian for no more than $20",
      seedPrefix: "saved-target-precedence",
    });

    expect(result.strategy.targets).toEqual([{
      playerName: "Jadarian Price",
      maxAuctionPrice: 12,
    }]);
    expect(result.targetOutcomes).toEqual([
      expect.objectContaining({ playerName: "Jadarian Price" }),
    ]);
  });

  it("uses personal values when choosing players for the claimed team", () => {
    const playerHumanValues = Object.fromEntries(
      auctionSetup.playerCatalog.map(player => [canonicalPlayerIdentityKey(player.name), 1]),
    );
    playerHumanValues["runner five"] = 20;

    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 1,
      playerHumanValues,
      seedPrefix: "personal-value-priority",
    });
    const humanRoster = result.runs[0]?.teams.find(team => team.isUserTeam)?.roster ?? [];

    expect(humanRoster).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerName: "Runner Five" }),
    ]));
  });

  it("does not let AI teams complete auction rosters with material unused budget", () => {
    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 3,
      seedPrefix: "auction-spend-discipline",
    });

    for (const run of result.runs) {
      const aiTeams = run.teams.filter(team => !team.isUserTeam);
      expect(aiTeams.every(team => team.roster.length === auctionSeason.settings.roster.rosterSize))
        .toBe(true);
      for (const team of aiTeams) {
        expect(
          team.budgetRemaining,
          `${team.teamName} should not finish with material unused budget: ${JSON.stringify(team.roster)}`,
        ).toBeLessThanOrEqual(auctionSeason.settings.auction.minimumBidDollars);
      }
    }
  });

  it("protects viable starting quarterbacks and projected depth while filling auction rosters", () => {
    const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        auction: { budgetDollars: 50, minimumBidDollars: 1 },
        roster: {
          rosterSize: 4,
          lineup: { QB: 1, WR: 1, FLEX: 1, BENCH: 1 },
          lineupSlotCount: 3,
          rosterMaximums: { QB: 2, RB: 3, WR: 3, TE: 0, K: 0, DST: 0 },
        },
      },
    };
    const startingQuarterbacks = Array.from({ length: 4 }, (_, index) => ({
      name: `Starting Quarterback ${index + 1}`,
      position: "QB" as const,
      expectedPrice: 4,
      week1Projection: 18 - index,
      weeks1To4Projection: 70 - index,
      seasonProjection: 280 - index,
    }));
    const backupQuarterbacks = Array.from({ length: 4 }, (_, index) => ({
      name: `Backup Quarterback ${index + 1}`,
      position: "QB" as const,
      expectedPrice: 1,
      week1Projection: 0.5 - index * 0.05,
      weeks1To4Projection: 2 - index * 0.1,
      seasonProjection: 10 - index,
    }));
    const depthPlayers = Array.from({ length: 12 }, (_, index) => ({
      name: `Projected Depth ${index + 1}`,
      position: (index % 3 === 0 ? "RB" : "WR") as "RB" | "WR",
      expectedPrice: index === 0 ? 22 : Math.max(1, 12 - index),
      week1Projection: 12 - index * 0.4,
      weeks1To4Projection: 48 - index,
      seasonProjection: 190 - index * 3,
    }));
    const setup: LiveDraftRoomSetup = {
      ...auctionSetup,
      initialRosters: [{
        teamId: "team-1",
        playerId: "projected depth 12",
        playerName: "Projected Depth 12",
        position: "WR",
        price: 24,
        source: "keeper",
      }],
      playerCatalog: [
        ...startingQuarterbacks,
        ...backupQuarterbacks,
        ...depthPlayers,
      ],
    };

    const result = runSeasonSimulations({
      season,
      setup,
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Draft Projected Depth 1 for no more than $22",
      seedPrefix: "viable-starting-lineups",
    });

    for (const team of result.runs[0]?.teams ?? []) {
      const quarterback = team.roster.find(player => player.rosterSlot === "QB");
      expect(
        quarterback?.week1Points,
        `${team.teamName} drafted a non-viable starting quarterback: ${JSON.stringify(team.roster)}`,
      ).toBeGreaterThanOrEqual(15);
      expect(
        team.roster
          .filter(player => player.rosterSlot.startsWith("BENCH"))
          .every(player => player.position === "RB" || player.position === "WR"),
        `${team.teamName} used a bench slot on a specialist: ${JSON.stringify(team.roster)}`,
      ).toBe(true);
    }
    const humanRoster = result.runs[0]?.teams.find(team => team.isUserTeam)?.roster ?? [];
    expect(humanRoster.filter(player => player.rosterSlot.startsWith("BENCH")))
      .toEqual([expect.objectContaining({ playerName: expect.stringMatching(/^Projected Depth /) })]);
  });

  it("keeps a named target affordable when an AI team nominates before the user", () => {
    const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        auction: { budgetDollars: 100, minimumBidDollars: 1 },
        roster: {
          rosterSize: 2,
          lineup: { RB: 2 },
          lineupSlotCount: 2,
          rosterMaximums: { QB: 0, RB: 2, WR: 0, TE: 0, K: 0, DST: 0 },
        },
      },
    };
    const playerNames = [
      "Alpha Runner",
      "Beta Runner",
      "Gamma Runner",
      "Delta Runner",
      "Epsilon Runner",
      "Zeta Runner",
      "Eta Runner",
      "Theta Runner",
    ];
    const setup: LiveDraftRoomSetup = {
      ...auctionSetup,
      initialRosters: [],
      playerCatalog: playerNames.map((name, index) => ({
        name,
        position: "RB" as const,
        expectedPrice: 10 - index,
      })),
    };
    const result = runSeasonSimulations({
      season,
      setup,
      humanTeamId: "team-2",
      runCount: 1,
      strategyInput: "draft Alpha Runner for no more than $20",
      seedPrefix: "ai-before-human",
    });

    expect(result.targetOutcome).toMatchObject({ hitCount: 1, hitRate: 1 });
    expect(result.runs[0]?.teams.filter(team => !team.isUserTeam)
      .every(team => team.budgetRemaining === 0)).toBe(true);

    const overCapacityTargets = runSeasonSimulations({
      season,
      setup,
      humanTeamId: "team-2",
      runCount: 1,
      strategyInput: playerNames
        .map(name => `draft ${name} for no more than $20`)
        .join(". "),
      seedPrefix: "over-capacity-targets",
    });
    expect(overCapacityTargets.runs[0]?.teams.filter(team => !team.isUserTeam)
      .every(team => team.budgetRemaining === 0)).toBe(true);
  });

  it("applies multiple named player caps throughout each auction run", () => {
    const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        auction: { budgetDollars: 100, minimumBidDollars: 1 },
        roster: {
          rosterSize: 3,
          lineup: { RB: 1, FLEX: 1, BENCH: 1 },
          lineupSlotCount: 2,
          rosterMaximums: { ...auctionSeason.settings.roster.rosterMaximums, RB: 3 },
        },
      },
    };
    const result = runSeasonSimulations({
      season,
      setup: {
        ...auctionSetup,
        initialRosters: [],
        playerCatalog: [
          ...auctionSetup.playerCatalog,
          { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 50 },
          { name: "Premium Quarterback", position: "QB", expectedPrice: 60 },
          { name: "Premium Tight End", position: "TE", expectedPrice: 55 },
        ],
      },
      humanTeamId: "team-1",
      runCount: 3,
      strategyInput: "draft jadarian price for no more than $20. Draft gibbs for no more than $76. Pair with gibbs",
      seedPrefix: "two-target-plan",
    });

    expect(result.strategy.warnings).toEqual([
      "Pair-with player gibbs is not a keeper; the simulation will also prioritize acquiring that player.",
    ]);
    expect(result.targetOutcomes).toHaveLength(2);
    expect(result.targetOutcomes?.map(outcome => outcome.playerName))
      .toEqual(["Jadarian Price", "Jahmyr Gibbs"]);
    expect(result.targetOutcomes?.every(outcome => outcome.hitCount === 3)).toBe(true);
    for (const run of result.runs) {
      const roster = run.teams.find(team => team.teamId === "team-1")?.roster ?? [];
      expect(roster[0]?.playerName).toBe("Jadarian Price");
      const jadarian = roster.find(player => player.playerName === "Jadarian Price");
      const gibbs = roster.find(player => player.playerName === "Jahmyr Gibbs");
      if (jadarian !== undefined) expect(jadarian.price).toBeLessThanOrEqual(20);
      if (gibbs !== undefined) expect(gibbs.price).toBeLessThanOrEqual(76);
    }
  });

  it("allows a named target above the cap while capping another player at that position", () => {
    const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        roster: {
          rosterSize: 3,
          lineup: { RB: 1, WR: 2 },
          lineupSlotCount: 3,
          rosterMaximums: { ...auctionSeason.settings.roster.rosterMaximums, WR: 2 },
        },
      },
    };
    const result = runSeasonSimulations({
      season,
      setup: {
        ...auctionSetup,
        initialRosters: [],
        playerCatalog: [
          ...auctionSetup.playerCatalog,
          { name: "Receiver Six", position: "WR", expectedPrice: 3 },
          { name: "Receiver Seven", position: "WR", expectedPrice: 2 },
          { name: "Receiver Eight", position: "WR", expectedPrice: 1 },
        ],
      },
      humanTeamId: "team-1",
      runCount: 3,
      strategyInput: "Draft Receiver One for no more than $30. Do not spend over $10 on another WR.",
      seedPrefix: "receiver-cap-plan",
    });

    expect(result.strategy.warnings).toEqual([]);
    for (const run of result.runs) {
      const roster = run.teams.find(team => team.teamId === "team-1")?.roster ?? [];
      const target = roster.find(player => player.playerName === "Receiver One");
      const otherReceiver = roster.find(player =>
        player.position === "WR" && player.playerName !== "Receiver One"
      );
      expect(target?.price).toBeGreaterThan(10);
      expect(target?.price).toBeLessThanOrEqual(30);
      expect(otherReceiver?.price).toBeLessThanOrEqual(10);
    }
  });

  it("does not exceed a counted auction preference or its price cap", () => {
    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 3,
      strategyInput: "Draft 2 elite RBs for no more than $10 each",
      seedPrefix: "counted-rb-plan",
    });

    for (const run of result.runs) {
      const roster = run.teams.find(team => team.teamId === "team-1")?.roster ?? [];
      const draftedRunningBacks = roster.filter(player =>
        player.position === "RB" && player.source !== "keeper"
      );
      expect(draftedRunningBacks.length).toBeLessThanOrEqual(1);
      expect(draftedRunningBacks.every(player => (player.price ?? 0) <= 10)).toBe(true);
    }
  });

  it("enforces and reports the league-relative auction elite tier", () => {
    const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        auction: { budgetDollars: 100, minimumBidDollars: 1 },
      },
    };
    const result = runSeasonSimulations({
      season,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 2,
      strategyInput: "Target an elite RB to pair with Achane",
      seedPrefix: "auction-elite-tier",
    });

    expect(result.preferenceOutcomes).toEqual([expect.objectContaining({
      position: "RB",
      tier: "elite",
      targetCount: 1,
      status: "hit",
      feasible: true,
      hitCount: 2,
      hitRate: 1,
      rule: {
        basis: "auction_expected_value",
        positionRankMaximum: 1,
        qualifyingPlayerIds: ["elite runner"],
        minimumExpectedValue: 45,
      },
    })]);
    for (const run of result.runs) {
      const roster = run.teams.find(team => team.teamId === "team-1")?.roster ?? [];
      expect(roster).toEqual(expect.arrayContaining([
        expect.objectContaining({ playerName: "Elite Runner", source: "human" }),
      ]));
    }
  });

  it("reports an infeasible elite auction preference instead of treating any RB as elite", () => {
    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Draft 2 elite RBs for no more than $10 each",
      seedPrefix: "infeasible-auction-elite-tier",
    });

    expect(result.preferenceOutcomes).toEqual([expect.objectContaining({
      position: "RB",
      tier: "elite",
      targetCount: 2,
      status: "infeasible",
      feasible: false,
      hitCount: 0,
      hitRate: 0,
    })]);
    expect(result.strategy.warnings).toContain(
      "Elite RB preference is infeasible: the league-relative tier and $10 cap cannot supply 2 players.",
    );
  });

  it("reports a feasible elite preference miss when the market clears above its cap", () => {
    const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        auction: { budgetDollars: 100, minimumBidDollars: 1 },
      },
    };
    const result = runSeasonSimulations({
      season,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Target 1 elite RB for no more than $45 to pair with Achane",
      seedPrefix: "missed-auction-elite-tier",
    });

    expect(result.preferenceOutcomes).toEqual([expect.objectContaining({
      position: "RB",
      status: "miss",
      feasible: true,
      hitCount: 0,
      hitRate: 0,
    })]);
  });

  it("closes feasible low-value auction budgets while preserving explicit caps", () => {
    const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        auction: { budgetDollars: 100, minimumBidDollars: 1 },
        roster: {
          rosterSize: 2,
          lineup: { RB: 2 },
          lineupSlotCount: 2,
          rosterMaximums: { QB: 0, RB: 2, WR: 0, TE: 0, K: 0, DST: 0 },
        },
      },
    };
    const setup: LiveDraftRoomSetup = {
      ...auctionSetup,
      initialRosters: [],
      playerCatalog: Array.from({ length: 8 }, (_, index) => ({
        name: `Low Value Runner ${index + 1}`,
        position: "RB" as const,
        expectedPrice: 1,
      })),
    };
    for (const humanTeamId of teams.map(team => team.id)) {
      const result = runSeasonSimulations({
        season,
        setup,
        humanTeamId,
        runCount: 1,
        seedPrefix: `human-closing-budget-${humanTeamId}`,
      });
      for (const team of result.runs[0]?.teams ?? []) {
        expect(
          team.budgetRemaining,
          `${team.teamName} retained budget after a feasible low-value run: ${JSON.stringify(team.roster)}`,
        ).toBeLessThanOrEqual(1);
      }
    }

    const capped = runSeasonSimulations({
      season,
      setup,
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Do not spend over $10 on another RB",
      seedPrefix: "human-closing-budget-capped",
    });
    const humanRoster = capped.runs[0]?.teams.find(team => team.teamId === "team-1")?.roster ?? [];
    expect(humanRoster.every(player => (player.price ?? 0) <= 10)).toBe(true);
  });

  it("completes deterministic snake runs with a round deadline and pick exposure", () => {
    const result = runSeasonSimulations({
      season: snakeSeason,
      setup: snakeSetup,
      humanTeamId: "team-1",
      runCount: 2,
      strategyInput: "Draft Target Receiver no later than round 2 to pair with De'Von Achane",
      seedPrefix: "snake-plan",
    });

    expect(result).toMatchObject({
      draftFormat: "snake",
      runCount: 2,
      completedCount: 2,
      targetOutcome: {
        playerName: "Target Receiver",
        hitCount: 2,
        hitRate: 1,
      },
      positionCounts: {
        RB: { total: 2, perRun: 1 },
        WR: { total: 2, perRun: 1 },
      },
    });
    expect(result.playerExposure.find(player => player.playerName === "Target Receiver"))
      .toMatchObject({ count: 2, rate: 1, averagePick: 1 });
    expect(result.runs).toHaveLength(2);
    expect(result.runs[0]?.teams).toHaveLength(4);
    expect(result.runs[0]?.teams.find(team => team.teamId === "team-1")?.roster).toEqual([
      expect.objectContaining({ playerName: "De'Von Achane", source: "keeper", round: 2 }),
      expect.objectContaining({ playerName: "Target Receiver", source: "human", overallPick: 1 }),
    ]);
  });

  it("enforces and reports the league-relative snake elite tier", () => {
    const result = runSeasonSimulations({
      season: snakeSeason,
      setup: snakeSetup,
      humanTeamId: "team-1",
      runCount: 2,
      strategyInput: "Target an elite WR",
      seedPrefix: "snake-elite-tier",
    });

    expect(result.preferenceOutcomes).toEqual([expect.objectContaining({
      position: "WR",
      tier: "elite",
      targetCount: 1,
      status: "hit",
      feasible: true,
      hitCount: 2,
      hitRate: 1,
      rule: {
        basis: "snake_catalog_rank",
        positionRankMaximum: 1,
        qualifyingPlayerIds: ["target receiver"],
      },
    })]);
    expect(result.runs[0]?.teams.find(team => team.teamId === "team-1")?.roster).toEqual([
      expect.objectContaining({ playerName: "De'Von Achane", source: "keeper" }),
      expect.objectContaining({ playerName: "Target Receiver", source: "human" }),
    ]);
  });

  it("returns typed boundary errors for invalid counts, claims, and setup configuration", () => {
    const baseInput = {
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      strategyInput: "",
    };

    for (const runCount of [0, 1.5, 101]) {
      expect(() => runSeasonSimulations({ ...baseInput, runCount }))
        .toThrow(new SeasonSimulationError(
          "invalid_run_count",
          "Simulation run count must be a whole number from 1 through 100.",
        ));
    }
    expect(runSeasonSimulations({ ...baseInput, runCount: 100 }).runs).toHaveLength(100);
    expect(() => runSeasonSimulations({ ...baseInput, humanTeamId: "missing", runCount: 1 }))
      .toThrowError(expect.objectContaining({ code: "human_team_missing" }));
    expect(() => runSeasonSimulations({
      ...baseInput,
      setup: { ...auctionSetup, seasonId: "another-season" },
      runCount: 1,
    })).toThrowError(expect.objectContaining({ code: "invalid_configuration" }));
  });

  it("warns when a parsed constraint belongs to the other draft format", () => {
    const auctionResult = runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Draft Jadarian Price by round 2",
    });
    const snakeResult = runSeasonSimulations({
      season: snakeSeason,
      setup: snakeSetup,
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Draft Target Receiver for no more than $12",
    });

    expect(auctionResult.strategy.warnings).toContain(
      "Round and pick deadlines do not apply to auction simulations; the player target was still prioritized.",
    );
    expect(snakeResult.strategy.warnings).toContain(
      "Auction price limits do not apply to snake simulations; the player target was still prioritized.",
    );
  });

  it("reports an unresolved target with a zero hit rate instead of pretending it was honored", () => {
    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Target Missing Player",
    });

    expect(result.targetOutcome).toEqual({
      playerId: "missing player",
      playerName: "Missing Player",
      hitCount: 0,
      hitRate: 0,
    });
    expect(result.strategy.warnings).toContain(
      "Target player Missing Player was not found in the player catalog.",
    );
  });

  it("runs both formats for a valid twenty-team league", () => {
    const largeTeams = Array.from({ length: 20 }, (_, index) => ({
      id: `large-team-${index + 1}`,
      leagueSeasonId: "large-season",
      ownerId: `large-owner-${index + 1}`,
      ownerDisplayName: `Owner ${index + 1}`,
      displayName: `Large Team ${index + 1}`,
      draftOrderPosition: index + 1,
    }));
    const playerCatalog = Array.from({ length: 20 }, (_, index) => ({
      name: `Large Player ${index + 1}`,
      position: "RB" as const,
      expectedPrice: 20 - Math.floor(index / 2),
    }));
    const roster = {
      rosterSize: 1,
      lineup: { RB: 1 },
      lineupSlotCount: 1,
      rosterMaximums: { QB: 1, RB: 1, WR: 1, TE: 1, K: 1, DST: 1 },
    };
    const largeSetup: LiveDraftRoomSetup = {
      seasonId: "large-season",
      sourceVersion: "test",
      playerCatalog,
      initialRosters: [],
      contentHash: "large-hash",
      updatedAt: new Date("2026-08-11T12:00:00.000Z"),
    };
    const largeAuctionSeason: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...commonSeason,
      id: "large-season",
      teams: largeTeams,
      settings: {
        expectedTeamCount: 20,
        draftFormat: "auction",
        scoring,
        auction: { budgetDollars: 100, minimumBidDollars: 1 },
        roster,
        keeperPolicy,
      },
    };
    const largeSnakeSeason: LeagueSeason<SnakeLeagueSeasonSettings> = {
      ...largeAuctionSeason,
      settings: {
        expectedTeamCount: 20,
        draftFormat: "snake",
        scoring,
        snake: { rounds: 1, order: largeTeams.map(team => team.id), reversal: "standard" },
        roster,
        keeperPolicy,
      },
    };

    expect(runSeasonSimulations({
      season: largeAuctionSeason,
      setup: largeSetup,
      humanTeamId: "large-team-20",
      runCount: 1,
    }).completedCount).toBe(1);
    expect(runSeasonSimulations({
      season: largeSnakeSeason,
      setup: largeSetup,
      humanTeamId: "large-team-20",
      runCount: 1,
    }).completedCount).toBe(1);
  });
});
