import type {
  ExplicitLeagueSeasonSettings,
  RosterMaximums,
  RosterRules,
  ScoringSettings,
} from "../../leagueSeason.js";
import { malformedSnapshot } from "../errors.js";
import {
  arrayValue,
  finiteNumber,
  nonEmptyString,
  nonNegativeInteger,
  numberRecord,
  plainRecord,
  positiveInteger,
} from "./primitives.js";

interface DecodedSettingsCore {
  expectedTeamCount: number;
  scoring: ScoringSettings;
  roster: RosterRules;
  keeperPolicy: {
    mode: "previous-cost-multiplier";
    multiplier: number;
    rounding: "ceil";
  };
}

const scoringValue = (value: unknown): ScoringSettings => {
  const record = plainRecord(value);
  return {
    passingYards: finiteNumber(record.passingYards),
    passingTouchdown: finiteNumber(record.passingTouchdown),
    rushingYards: finiteNumber(record.rushingYards),
    rushingTouchdown: finiteNumber(record.rushingTouchdown),
    receivingYards: finiteNumber(record.receivingYards),
    receivingTouchdown: finiteNumber(record.receivingTouchdown),
    reception: finiteNumber(record.reception),
  };
};

const rosterMaximumsValue = (value: unknown): RosterMaximums => {
  const record = plainRecord(value);
  return {
    QB: nonNegativeInteger(record.QB),
    RB: nonNegativeInteger(record.RB),
    WR: nonNegativeInteger(record.WR),
    TE: nonNegativeInteger(record.TE),
    K: nonNegativeInteger(record.K),
    DST: nonNegativeInteger(record.DST),
  };
};

const settingsCore = (record: Record<string, unknown>): DecodedSettingsCore => {
  const rosterRecord = plainRecord(record.roster);
  const keeperPolicyRecord = plainRecord(record.keeperPolicy);
  if (
    keeperPolicyRecord.mode !== "previous-cost-multiplier"
    || keeperPolicyRecord.rounding !== "ceil"
  ) return malformedSnapshot();

  return {
    expectedTeamCount: positiveInteger(record.expectedTeamCount),
    scoring: scoringValue(record.scoring),
    roster: {
      rosterSize: positiveInteger(rosterRecord.rosterSize),
      lineup: numberRecord(rosterRecord.lineup, true),
      lineupSlotCount: nonNegativeInteger(rosterRecord.lineupSlotCount),
      rosterMaximums: rosterMaximumsValue(rosterRecord.rosterMaximums),
    },
    keeperPolicy: {
      mode: "previous-cost-multiplier",
      multiplier: finiteNumber(keeperPolicyRecord.multiplier),
      rounding: "ceil",
    },
  };
};

export const settingsValue = (value: unknown): ExplicitLeagueSeasonSettings => {
  const record = plainRecord(value);
  const core = settingsCore(record);
  if (record.draftFormat === "auction") {
    const auction = plainRecord(record.auction);
    return {
      ...core,
      draftFormat: "auction",
      auction: {
        budgetDollars: finiteNumber(auction.budgetDollars),
        minimumBidDollars: finiteNumber(auction.minimumBidDollars),
      },
    };
  }
  if (record.draftFormat === "snake") {
    const snake = plainRecord(record.snake);
    if (snake.reversal !== "standard" && snake.reversal !== "third-round") {
      return malformedSnapshot();
    }
    return {
      ...core,
      draftFormat: "snake",
      snake: {
        rounds: positiveInteger(snake.rounds),
        order: arrayValue(snake.order).map(nonEmptyString),
        reversal: snake.reversal,
      },
    };
  }
  return malformedSnapshot();
};
