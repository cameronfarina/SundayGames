import { describe, expect, it } from "vitest";

import { assertConfiguration } from "../src/platform/auction/configuration.js";
import type { GenericAuctionMockConfig } from "../src/platform/auction/types.js";

const configuration = (
  overrides: Partial<GenericAuctionMockConfig> = {},
): GenericAuctionMockConfig => ({
  sessionId: "session",
  seed: "seed",
  humanTeamId: "human",
  budgetDollars: 20,
  minimumBidDollars: 1,
  teams: [
    { id: "human", name: "Human" },
    { id: "one", name: "One" },
    { id: "two", name: "Two" },
    { id: "three", name: "Three" },
  ],
  rosterSlots: [{ slot: "FLEX", count: 1, eligiblePositions: ["RB", "WR"] }],
  positionMaximums: { RB: 1, WR: 1 },
  players: [
    { id: "rb", name: "Runner", position: "RB", expectedPrice: 5 },
    { id: "wr-one", name: "Receiver One", position: "WR", expectedPrice: 4 },
    { id: "wr-two", name: "Receiver Two", position: "WR", expectedPrice: 3 },
    { id: "wr-three", name: "Receiver Three", position: "WR", expectedPrice: 2 },
  ],
  ...overrides,
});

interface InvalidCase {
  config: GenericAuctionMockConfig;
  message: string;
}

const invalidCases = (): readonly InvalidCase[] => [
  {
    config: configuration({ sessionId: " " }),
    message: "Auction session id and seed are required.",
  },
  {
    config: configuration({ teams: configuration().teams.slice(0, 3) }),
    message: "Auction mocks require between 4 and 20 teams.",
  },
  {
    config: configuration({
      teams: [
        { id: "human", name: "Human" },
        { id: "human", name: "Duplicate" },
        { id: "two", name: "Two" },
        { id: "three", name: "Three" },
      ],
    }),
    message: "Every auction team needs a unique non-blank id and a non-blank name.",
  },
  {
    config: configuration({ humanTeamId: "missing" }),
    message: "Human team id must identify a configured team.",
  },
  {
    config: configuration({ minimumBidDollars: 0 }),
    message: "Auction budget and minimum bid must be positive whole-dollar amounts.",
  },
  {
    config: configuration({ rosterSlots: [] }),
    message: "Roster slots require a name, positive count, and unique eligible positions.",
  },
  {
    config: configuration({
      rosterSlots: [
        { slot: "RB", count: 2, eligiblePositions: ["RB"] },
        { slot: "RB2", count: 1, eligiblePositions: ["RB"] },
      ],
    }),
    message: "Roster slot names must remain unique after their counts are expanded.",
  },
  {
    config: configuration({ budgetDollars: 1, rosterSlots: [
      { slot: "FLEX", count: 2, eligiblePositions: ["RB", "WR"] },
    ] }),
    message: "Auction budget must reserve the minimum bid for every roster slot.",
  },
  {
    config: configuration({ positionMaximums: {} }),
    message: "At least one position maximum is required.",
  },
  {
    config: configuration({ positionMaximums: { RB: -1, WR: 1 } }),
    message: "Position maximums must be non-negative whole numbers keyed by position.",
  },
  {
    config: configuration({ players: [
      ...configuration().players,
      { id: "rb", name: "Duplicate", position: "RB", expectedPrice: 1 },
    ] }),
    message: "Every player needs a unique id, name, position, and non-negative expected price.",
  },
  {
    config: configuration({ players: [
      { id: "rb", name: "Runner", position: "RB", expectedPrice: 5, humanValue: -1 },
    ] }),
    message: "Every player needs a unique id, name, position, and non-negative expected price.",
  },
  {
    config: configuration({ players: [
      { id: "rb", name: "Runner", position: "RB", expectedPrice: 5, week1Projection: -1 },
    ] }),
    message: "Every player needs a unique id, name, position, and non-negative expected price.",
  },
  {
    config: configuration({ players: [
      { id: "rb", name: "Runner", position: "RB", expectedPrice: 5, weeks1To4Projection: -1 },
    ] }),
    message: "Every player needs a unique id, name, position, and non-negative expected price.",
  },
  {
    config: configuration({ players: [
      { id: "rb", name: "Runner", position: "RB", expectedPrice: 5, seasonProjection: -1 },
    ] }),
    message: "Every player needs a unique id, name, position, and non-negative expected price.",
  },
  {
    config: configuration({ positionMaximums: { RB: 1 } }),
    message: "Every roster and player position must have an explicit position maximum.",
  },
  {
    config: configuration({ ai: { randomness: -0.1 } }),
    message: "AI settings must be non-negative finite numbers.",
  },
  {
    config: configuration({ ai: { targetEndingBudgetDollars: 20 } }),
    message: "AI target ending budget must be a non-negative whole-dollar amount below the auction budget.",
  },
  {
    config: configuration({ ai: { spendPacingExcludedPlayerIds: ["rb", "rb"] } }),
    message: "AI spend-pacing exclusions must reference unique players in the auction catalog.",
  },
  {
    config: configuration({ plannedAcquisitions: [
      { teamId: "one", playerId: "rb", price: 5 },
    ] }),
    message: "Planned acquisitions require unique catalog players, the human team, and valid prices.",
  },
  {
    config: configuration({ teams: [
      { id: "human", name: "Human", aiTendency: { bidMultiplier: -1 } },
      ...configuration().teams.slice(1),
    ] }),
    message: "AI bid multipliers must be non-negative finite numbers.",
  },
  {
    config: configuration({ teams: [
      { id: "human", name: "Human", aiTendency: { randomness: -1 } },
      ...configuration().teams.slice(1),
    ] }),
    message: "AI randomness must be a non-negative finite number.",
  },
  {
    config: configuration({ teams: [
      { id: "human", name: "Human", aiTendency: { positionBidMultipliers: { " ": 1 } } },
      ...configuration().teams.slice(1),
    ] }),
    message: "AI position bid multipliers must use non-blank keys and non-negative finite values.",
  },
  {
    config: configuration({ teams: [
      { id: "human", name: "Human", aiTendency: { nominationPositionWeights: { RB: -1 } } },
      ...configuration().teams.slice(1),
    ] }),
    message: "AI nomination weights must use non-blank keys and non-negative finite values.",
  },
];

describe("auction configuration", () => {
  it("accepts complete price-formation inputs", () => {
    expect(() => assertConfiguration(configuration({
      ai: {
        defaultBidMultiplier: 1.1,
        rosterNeedDollars: 2,
        randomness: 0.1,
        targetEndingBudgetDollars: 1,
        spendPacingExcludedPlayerIds: ["rb"],
      },
      plannedAcquisitions: [{ teamId: "human", playerId: "rb", price: 5 }],
      teams: [
        {
          id: "human",
          name: "Human",
          aiTendency: {
            bidMultiplier: 1.2,
            randomness: 0.2,
            positionBidMultipliers: { RB: 1.1 },
            nominationPositionWeights: { WR: 2 },
          },
        },
        ...configuration().teams.slice(1),
      ],
    }))).not.toThrow();
  });

  it("preserves every configuration validation contract", () => {
    for (const invalidCase of invalidCases()) {
      expect(() => assertConfiguration(invalidCase.config)).toThrowError(invalidCase.message);
    }
  });
});
