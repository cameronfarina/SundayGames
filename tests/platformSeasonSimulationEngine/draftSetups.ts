import type { LiveDraftRoomSetup } from "../../src/platform/liveDraftRoomSetups.js";
import { auctionSeason, snakeSeason } from "./leagueFixtures.js";

export const auctionSetup: LiveDraftRoomSetup = {
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

export const snakeSetup: LiveDraftRoomSetup = {
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
