import { describe, expect, it } from "vitest";

import {
  applyGenericAuctionMockCommand,
  createGenericAuctionMockState,
  type GenericAuctionMockConfig,
} from "../src/platform/genericAuctionMockEngine.js";
import type {
  AuctionLeagueSeasonSettings,
  LeagueSeason,
} from "../src/platform/leagueSeason.js";
import type { LiveDraftRoomSetup } from "../src/platform/liveDraftRoomSetups.js";
import { runSeasonSimulations } from "../src/platform/seasonSimulationEngine.js";

const teams = ["Human", "Bidder", "Filled One", "Filled Two"].map((name, index) => ({
  id: index === 0 ? "human" : `team-${index + 1}`,
  leagueSeasonId: "season-2026",
  ownerId: `owner-${index + 1}`,
  ownerDisplayName: name,
  displayName: name,
  draftOrderPosition: index + 1,
}));

const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
  id: "season-2026",
  leagueId: "league-1",
  league: { id: "league-1", externalLeagueId: "1", name: "Parity", provider: "mockd" },
  seasonYear: 2026,
  setupStatus: "published",
  teams,
  settings: {
    expectedTeamCount: 4,
    draftFormat: "auction",
    scoring: {
      passingYards: 0.04, passingTouchdown: 4, rushingYards: 0.1,
      rushingTouchdown: 6, receivingYards: 0.1, receivingTouchdown: 6, reception: 0.5,
    },
    auction: { budgetDollars: 20, minimumBidDollars: 1 },
    roster: {
      rosterSize: 1,
      lineup: { RB: 1 },
      lineupSlotCount: 1,
      rosterMaximums: { QB: 0, RB: 1, WR: 0, TE: 0, K: 0, DST: 0 },
    },
    keeperPolicy: { mode: "previous-cost-multiplier", multiplier: 1.2, rounding: "ceil" },
  },
};

const setup: LiveDraftRoomSetup = {
  seasonId: season.id,
  sourceVersion: "test",
  playerCatalog: [
    { name: "Target RB", position: "RB", expectedPrice: 2 },
    { name: "Fallback RB", position: "RB", expectedPrice: 60 },
    { name: "Keeper One", position: "RB", expectedPrice: 1 },
    { name: "Keeper Two", position: "RB", expectedPrice: 1 },
  ],
  initialRosters: [
    {
      teamId: "team-3", playerId: "keeper one", playerName: "Keeper One",
      position: "RB", price: 1, source: "keeper",
    },
    {
      teamId: "team-4", playerId: "keeper two", playerName: "Keeper Two",
      position: "RB", price: 1, source: "keeper",
    },
  ],
  contentHash: "parity",
  updatedAt: new Date("2026-08-14T00:00:00.000Z"),
};

const interactiveSalePrice = (): number | undefined => {
  const config: GenericAuctionMockConfig = {
    sessionId: "interactive-parity",
    seed: "parity:1",
    humanTeamId: "human",
    budgetDollars: 20,
    minimumBidDollars: 1,
    teams: teams.map(team => ({ id: team.id, name: team.displayName })),
    rosterSlots: [{ slot: "RB", count: 1, eligiblePositions: ["RB"] }],
    positionMaximums: { RB: 1 },
    players: [
      { id: "target rb", name: "Target RB", position: "RB", expectedPrice: 2 },
      { id: "fallback rb", name: "Fallback RB", position: "RB", expectedPrice: 60 },
      { id: "keeper one", name: "Keeper One", position: "RB", expectedPrice: 1 },
      { id: "keeper two", name: "Keeper Two", position: "RB", expectedPrice: 1 },
    ],
    keepers: [
      { teamId: "team-3", playerId: "keeper one", price: 1 },
      { teamId: "team-4", playerId: "keeper two", price: 1 },
    ],
    ai: { defaultBidMultiplier: 1, rosterNeedDollars: 0, randomness: 0 },
  };
  const started = applyGenericAuctionMockCommand(createGenericAuctionMockState(config), {
    type: "start", expectedRevision: 0,
  });
  const nominated = applyGenericAuctionMockCommand(started, {
    type: "nominate", expectedRevision: started.session.revision,
    playerId: "target rb", openingBid: 1,
  });
  const bought = applyGenericAuctionMockCommand(nominated, {
    type: "buy", expectedRevision: nominated.session.revision,
    price: nominated.session.currentNomination?.nextBid ?? 0,
  });
  return bought.sales.find(sale => sale.playerId === "target rb")?.price;
};

describe("simulation auction parity", () => {
  it("submits the real next bid on the simulated human team's final slot", () => {
    const result = runSeasonSimulations({
      season, setup, humanTeamId: "human", runCount: 1,
      targetConstraints: [{ playerName: "Target RB" }], seedPrefix: "parity",
    });
    const simulatedPrice = result.runs[0]?.teams.find(team => team.isUserTeam)?.roster
      .find(player => player.playerName === "Target RB")?.price;

    expect(interactiveSalePrice()).toBe(3);
    expect(simulatedPrice).toBe(interactiveSalePrice());
  });
});
