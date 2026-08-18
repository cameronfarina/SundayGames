import type { Position } from "../../../config/league.js";

export const balancedScenarioId = "balanced";
export const flatPricedPositions = new Set<Position>(["K", "DST"]);
export const flatPricedDollars = 2;
export const minimumCountedSaleDollars = 3;
export const historyUnavailableWarning =
  "league auction history unavailable; prices are scaled by league money alone";
export const inflationUnavailableWarning =
  "league inflation unavailable; using published market prices unchanged";
export const scenarioAssumptionsUnavailableWarning =
  "scenario-specific assumptions unavailable; using the league-calibrated value";
