import type { KeeperScenarioKey } from "../keeperInflation.js";

export const defaultScenarioKey: KeeperScenarioKey = "expected";
export const defaultLimit = 40;
export const defaultRuns = 10;
export const defaultSeedPrefix = "top-sanity";
export const highMockPremiumThreshold = 6;
export const largeProjectionLiftThreshold = -5;
export const largeProjectionLiftPriceThreshold = 45;
export const extremeProjectionLiftThreshold = -30;
export const expensiveMissingEvidenceThreshold = 50;
export const contextPenaltyThreshold = -0.03;
export const highPriceThresholds: readonly number[] = [70, 75, 80];
