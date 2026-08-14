import type {
  KeeperPolicy,
  LeagueSeasonSettings,
  RosterMaximums,
  RosterRules,
  ScoringSettings,
} from "../../leagueSeason.js";
import {
  integerValue,
  invalidSnapshot,
  numberValue,
  numericRecordValue,
  recordValue,
  stringArrayValue,
} from "./primitives.js";

interface DecodedCoreSettings {
  expectedTeamCount: number;
  roster: RosterRules;
  keeperPolicy: KeeperPolicy;
}

const scoringValue = (value: unknown, path: string): ScoringSettings => {
  const record = recordValue(value, path);
  return {
    passingYards: numberValue(record.passingYards, `${path}.passingYards`),
    passingTouchdown: numberValue(record.passingTouchdown, `${path}.passingTouchdown`),
    rushingYards: numberValue(record.rushingYards, `${path}.rushingYards`),
    rushingTouchdown: numberValue(record.rushingTouchdown, `${path}.rushingTouchdown`),
    receivingYards: numberValue(record.receivingYards, `${path}.receivingYards`),
    receivingTouchdown: numberValue(record.receivingTouchdown, `${path}.receivingTouchdown`),
    reception: numberValue(record.reception, `${path}.reception`),
  };
};

const rosterMaximumsValue = (value: unknown, path: string): RosterMaximums => {
  const record = recordValue(value, path);
  return {
    QB: integerValue(record.QB, `${path}.QB`),
    RB: integerValue(record.RB, `${path}.RB`),
    WR: integerValue(record.WR, `${path}.WR`),
    TE: integerValue(record.TE, `${path}.TE`),
    K: integerValue(record.K, `${path}.K`),
    DST: integerValue(record.DST, `${path}.DST`),
  };
};

const rosterValue = (value: unknown, path: string): RosterRules => {
  const record = recordValue(value, path);
  return {
    rosterSize: integerValue(record.rosterSize, `${path}.rosterSize`),
    lineup: numericRecordValue(record.lineup, `${path}.lineup`),
    lineupSlotCount: integerValue(record.lineupSlotCount, `${path}.lineupSlotCount`),
    rosterMaximums: rosterMaximumsValue(record.rosterMaximums, `${path}.rosterMaximums`),
  };
};

export const leagueSettingsValue = (value: unknown, path: string): LeagueSeasonSettings => {
  const record = recordValue(value, path);
  const core = {
    expectedTeamCount: integerValue(record.expectedTeamCount, `${path}.expectedTeamCount`),
    roster: rosterValue(record.roster, `${path}.roster`),
    keeperPolicy: keeperPolicyValue(record.keeperPolicy, `${path}.keeperPolicy`),
  };
  if (record.draftFormat === "snake") return snakeSettings(record, path, core);
  if (record.draftFormat === undefined || record.draftFormat === "auction") {
    return auctionSettings(record, path, core);
  }
  return invalidSnapshot(`${path}.draftFormat`);
};

const keeperPolicyValue = (value: unknown, path: string): KeeperPolicy => {
  const record = recordValue(value, path);
  if (record.mode !== "previous-cost-multiplier") return invalidSnapshot(`${path}.mode`);
  if (record.rounding !== "ceil") return invalidSnapshot(`${path}.rounding`);
  return { mode: record.mode, multiplier: numberValue(record.multiplier, `${path}.multiplier`), rounding: record.rounding };
};

const auctionSettings = (
  record: Record<string, unknown>,
  path: string,
  core: DecodedCoreSettings,
): LeagueSeasonSettings => {
  const auction = recordValue(record.auction, `${path}.auction`);
  const auctionValue = {
    budgetDollars: numberValue(auction.budgetDollars, `${path}.auction.budgetDollars`),
    minimumBidDollars: numberValue(auction.minimumBidDollars, `${path}.auction.minimumBidDollars`),
  };
  if (record.draftFormat === undefined) return {
    ...core,
    auction: auctionValue,
  };
  return {
    ...core,
    draftFormat: "auction",
    scoring: scoringValue(record.scoring, `${path}.scoring`),
    auction: auctionValue,
  };
};

const snakeSettings = (
  record: Record<string, unknown>,
  path: string,
  core: DecodedCoreSettings,
): LeagueSeasonSettings => {
  const snake = recordValue(record.snake, `${path}.snake`);
  const reversal = snake.reversal;
  if (reversal !== "standard" && reversal !== "third-round") {
    return invalidSnapshot(`${path}.snake.reversal`);
  }
  return {
    ...core,
    draftFormat: "snake",
    scoring: scoringValue(record.scoring, `${path}.scoring`),
    snake: {
      rounds: integerValue(snake.rounds, `${path}.snake.rounds`),
      order: stringArrayValue(snake.order, `${path}.snake.order`),
      reversal,
    },
  };
};
