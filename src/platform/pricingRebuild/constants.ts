import type { Position } from "../../../config/league.js";

export const balancedScenarioId = "balanced";
export const flatPricedPositions = new Set<Position>(["K", "DST"]);
export const flatPricedDollars = 2;
export const minimumCountedSaleDollars = 3;
// A league that pays nothing, or a hundred times published market prices, has
// mistyped rather than described itself.
export const minimumManualInflationMultiplier = 0.01;
export const maximumManualInflationMultiplier = 10;
export const historyUnavailableWarning =
  "league auction history unavailable; prices are scaled by league money alone";
export const inflationUnavailableWarning =
  "league inflation unavailable; using published market prices unchanged";
export const manualInflationWarning =
  "no auction history imported; using the inflation percentage set for this league";
export const slotFloorWarning =
  "imported slot prices set a floor for each position rank";
export const scenarioAssumptionsUnavailableWarning =
  "scenario-specific assumptions unavailable; using the league-calibrated value";
