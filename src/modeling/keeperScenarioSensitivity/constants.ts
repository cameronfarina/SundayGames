import type { KeeperScenarioKey } from "../keeperInflation.js";

export const keeperScenarioSensitivityKeys: readonly KeeperScenarioKey[] = [
  "confirmedOnly",
  "expected",
  "highRetention",
];

export const defaultKeeperScenarioSensitivityLimit = 60;
export const outsidePricedPoolReason = "outside priced auction pool";
