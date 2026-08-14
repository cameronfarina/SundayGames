import type { ForcedAuctionSale, MockBatch } from "../../src/modeling/mockBatch.js";
import type {
  CreateSimulationRequestInput,
  SimulationSoftTargetInput,
} from "../../src/platform/simulations.js";

export const now = new Date("2026-08-09T16:00:00.000Z");

export const softTargets: readonly SimulationSoftTargetInput[] = [
  {
    label: "good-not-elite-rb2",
    candidatePool: ["Breece Hall", "Kenneth Walker III", "Chase Brown"],
    maxBid: 35,
  },
  {
    label: "value-wrs",
    candidatePool: ["Davante Adams", "Zay Flowers", "Tee Higgins", "Ladd McConkey"],
    maxBid: 22,
  },
];

export const baseRequestInput: CreateSimulationRequestInput = {
  userId: "user_cam",
  leagueId: "league_100001",
  seasonId: "season_2026",
  ownerId: "owner_cam",
  teamId: "team_cam",
  count: 25,
  seedPrefix: "owner11-balanced-rb3",
  idempotencyKey: "balanced-rb3",
  strategy: {
    hardLocks: [{
      playerName: "Jadarian Price",
      price: 13,
      priceMode: "exact",
      auctionOwner: "Owner11",
    }],
    softTargets,
  },
};

export const fakeBatch = ({
  runsPerScenario,
  seedPrefix,
  forcedSales,
}: {
  runsPerScenario: number;
  seedPrefix: string;
  forcedSales: readonly ForcedAuctionSale[];
}): MockBatch => ({
  options: {
    scenarioKeys: ["expected"],
    runsPerScenario,
    seedPrefix,
    forcedSales: [...forcedSales],
  },
  runs: [],
  summary: {
    runCount: runsPerScenario,
    scenarios: [],
    players: [],
    owners: [],
    ownerPlayerExposure: [],
  },
});
