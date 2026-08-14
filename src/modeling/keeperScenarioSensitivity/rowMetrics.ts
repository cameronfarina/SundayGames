import type { KeeperScenarioKey } from "../keeperInflation.js";
import { keeperScenarioSensitivityKeys } from "./constants.js";
import type {
  KeeperScenarioPlayerState,
  KeeperScenarioPlayerStates,
  UnrankedSensitivityRow,
} from "./contracts.js";

export interface RowMetrics {
  priceSpread: number | null;
  expectedVsConfirmedDelta: number | null;
  highRetentionVsExpectedDelta: number | null;
  keeperRemoved: boolean;
  keeperRemovalChanged: boolean;
  availabilityChanged: boolean;
  unavailableScenarios: KeeperScenarioKey[];
  keeperRemovalScenarios: KeeperScenarioKey[];
  largestDelta: number;
}

const deltaBetween = (
  left: KeeperScenarioPlayerState,
  right: KeeperScenarioPlayerState,
): number | null => left.scenarioPrice === null || right.scenarioPrice === null
  ? null
  : right.scenarioPrice - left.scenarioPrice;

const scenarioPrices = (states: KeeperScenarioPlayerStates): number[] =>
  keeperScenarioSensitivityKeys.flatMap(key => {
    const value = states[key].scenarioPrice;
    return value === null ? [] : [value];
  });

export const metricsFor = (states: KeeperScenarioPlayerStates): RowMetrics => {
  const values = scenarioPrices(states);
  const priceSpread = values.length < 2 ? null : Math.max(...values) - Math.min(...values);
  const unavailableScenarios = keeperScenarioSensitivityKeys.filter(
    key => !states[key].available,
  );
  const keeperRemovalScenarios = keeperScenarioSensitivityKeys.filter(
    key => states[key].keeperRemoved,
  );
  const keeperRemoved = keeperRemovalScenarios.length > 0;
  const keeperRemovalChanged = keeperRemoved
    && keeperRemovalScenarios.length < keeperScenarioSensitivityKeys.length;
  const availabilityChanged = unavailableScenarios.length > 0
    && unavailableScenarios.length < keeperScenarioSensitivityKeys.length;
  const expectedVsConfirmedDelta = deltaBetween(states.confirmedOnly, states.expected);
  const highRetentionVsExpectedDelta = deltaBetween(states.expected, states.highRetention);
  const largestDelta = Math.max(
    Math.abs(expectedVsConfirmedDelta ?? 0),
    Math.abs(highRetentionVsExpectedDelta ?? 0),
    priceSpread ?? 0,
  );
  return {
    priceSpread,
    expectedVsConfirmedDelta,
    highRetentionVsExpectedDelta,
    keeperRemoved,
    keeperRemovalChanged,
    availabilityChanged,
    unavailableScenarios,
    keeperRemovalScenarios,
    largestDelta,
  };
};

export const sortSensitivityRows = (
  left: UnrankedSensitivityRow,
  right: UnrankedSensitivityRow,
): number => right.sortScore - left.sortScore
  || (right.priceSpread ?? 0) - (left.priceSpread ?? 0)
  || (right.basePrice ?? 0) - (left.basePrice ?? 0)
  || left.player.localeCompare(right.player);
