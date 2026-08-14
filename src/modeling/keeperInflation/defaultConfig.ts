import { leagueConfig } from "../../../config/league.js";
import type { KeeperScenarioConfig } from "./contracts.js";

export const defaultKeeperScenarioConfig: KeeperScenarioConfig = {
  leagueTotalBudget: leagueConfig.teams * leagueConfig.auctionBudget,
  historicalOpenAuctionSpendBaseline: 2596.5,
  typicalKeeperCounts: { QB: 1, RB: 6, WR: 6, TE: 1, K: 0, DST: 0 },
  scarcityRates: { QB: 0.02, RB: 0.015, WR: 0.015, TE: 0.02, K: 0, DST: 0 },
  scenarios: [
    {
      key: "confirmedOnly",
      label: "Confirmed Only",
      includedKeeperStatuses: ["confirmed"],
    },
    {
      key: "expected",
      label: "Expected",
      includedKeeperStatuses: ["confirmed", "assumed"],
      keeperCounts: { QB: 1, RB: 6, WR: 6, TE: 1, K: 0, DST: 0 },
      averageKeeperCosts: { QB: 2, RB: 8, WR: 8, TE: 8, K: 0, DST: 0 },
    },
    {
      key: "highRetention",
      label: "High Retention / Cheap Surplus",
      includedKeeperStatuses: ["confirmed", "assumed"],
      keeperCounts: { QB: 1, RB: 8, WR: 5, TE: 0, K: 0, DST: 0 },
      averageKeeperCosts: { QB: 2, RB: 6, WR: 7, TE: 0, K: 0, DST: 0 },
    },
  ],
};
