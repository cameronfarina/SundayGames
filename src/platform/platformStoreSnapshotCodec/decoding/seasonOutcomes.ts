import type { SeasonSimulationPreferenceOutcome } from "../../seasonSimulationPreferences.js";
import type {
  SeasonSimulationTargetOutcome,
  SeasonSimulationTargetOutcomeReason,
} from "../../seasonSimulationTargets.js";
import { stringArrayValue } from "./primitives.js";
import {
  booleanValue,
  integerValue,
  invalidSnapshot,
  numberValue,
  optionalValue,
  recordValue,
  stringValue,
} from "./primitives.js";

const statusValue = (value: unknown, path: string): "hit" | "miss" | "infeasible" => {
  if (value === "hit" || value === "miss" || value === "infeasible") return value;
  return invalidSnapshot(path);
};

const reasonValue = (value: unknown, path: string): SeasonSimulationTargetOutcomeReason => {
  if (value === "ambiguous_player_name" || value === "insufficient_auction_budget"
    || value === "insufficient_roster_slots" || value === "player_not_found"
    || value === "retained_by_other_team" || value === "retained_by_your_team_above_max_price") {
    return value;
  }
  return invalidSnapshot(path);
};

export const targetOutcomeValue = (value: unknown, path: string): SeasonSimulationTargetOutcome => {
  const record = recordValue(value, path);
  return {
    playerId: stringValue(record.playerId, `${path}.playerId`),
    playerName: stringValue(record.playerName, `${path}.playerName`),
    status: statusValue(record.status, `${path}.status`),
    feasible: booleanValue(record.feasible, `${path}.feasible`),
    hitCount: integerValue(record.hitCount, `${path}.hitCount`),
    hitRate: numberValue(record.hitRate, `${path}.hitRate`),
    reason: optionalValue(record.reason, `${path}.reason`, reasonValue),
    message: stringValue(record.message, `${path}.message`),
  };
};

export const preferenceOutcomeValue = (
  value: unknown,
  path: string,
): SeasonSimulationPreferenceOutcome => {
  const record = recordValue(value, path);
  const rule = recordValue(record.rule, `${path}.rule`);
  const position = record.position;
  const basis = rule.basis;
  if (position !== "QB" && position !== "RB" && position !== "WR" && position !== "TE") {
    return invalidSnapshot(`${path}.position`);
  }
  if (record.tier !== "elite") return invalidSnapshot(`${path}.tier`);
  if (basis !== "auction_expected_value" && basis !== "snake_catalog_rank") {
    return invalidSnapshot(`${path}.rule.basis`);
  }
  return {
    position,
    tier: record.tier,
    targetCount: integerValue(record.targetCount, `${path}.targetCount`),
    status: statusValue(record.status, `${path}.status`),
    feasible: booleanValue(record.feasible, `${path}.feasible`),
    hitCount: integerValue(record.hitCount, `${path}.hitCount`),
    hitRate: numberValue(record.hitRate, `${path}.hitRate`),
    rule: {
      basis,
      positionRankMaximum: integerValue(rule.positionRankMaximum, `${path}.rule.positionRankMaximum`),
      qualifyingPlayerIds: stringArrayValue(rule.qualifyingPlayerIds, `${path}.rule.qualifyingPlayerIds`),
      minimumExpectedValue: optionalValue(rule.minimumExpectedValue, `${path}.rule.minimumExpectedValue`, numberValue),
    },
    message: stringValue(record.message, `${path}.message`),
  };
};
