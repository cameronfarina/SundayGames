import type {
  LeagueSeasonSettings,
  LineupSettings,
  RosterMaximums,
} from "../leagueSeason.js";
import { keeperPolicyModes, keeperPolicyRoundings } from "./constants.js";
import {
  enumAt,
  fail,
  integerAt,
  objectAt,
  positiveNumberAt,
} from "./validation.js";

const lineupAt = (value: unknown): LineupSettings => {
  const record = objectAt(value, "season.settings.roster.lineup");
  const lineup: LineupSettings = {};
  for (const [slot, count] of Object.entries(record)) {
    lineup[slot] = integerAt(count, `season.settings.roster.lineup.${slot}`);
  }
  if (Object.keys(lineup).length === 0) {
    fail("season.settings.roster.lineup", "expected at least one lineup slot.");
  }
  return lineup;
};

const rosterMaximumsAt = (value: unknown): RosterMaximums => {
  const record = objectAt(value, "season.settings.roster.rosterMaximums");
  return {
    QB: integerAt(record.QB, "season.settings.roster.rosterMaximums.QB", 1),
    RB: integerAt(record.RB, "season.settings.roster.rosterMaximums.RB", 1),
    WR: integerAt(record.WR, "season.settings.roster.rosterMaximums.WR", 1),
    TE: integerAt(record.TE, "season.settings.roster.rosterMaximums.TE", 1),
    K: integerAt(record.K, "season.settings.roster.rosterMaximums.K", 1),
    DST: integerAt(record.DST, "season.settings.roster.rosterMaximums.DST", 1),
  };
};

export const settingsAt = (value: unknown, teamCount: number): LeagueSeasonSettings => {
  const record = objectAt(value, "season.settings");
  const auction = objectAt(record.auction, "season.settings.auction");
  const roster = objectAt(record.roster, "season.settings.roster");
  const keeperPolicy = objectAt(record.keeperPolicy, "season.settings.keeperPolicy");
  const lineup = lineupAt(roster.lineup);
  const rosterSize = integerAt(roster.rosterSize, "season.settings.roster.rosterSize", 1);
  const lineupSlotCount = Object.values(lineup).reduce((total, count) => total + count, 0);
  if (rosterSize !== lineupSlotCount) {
    fail("season.settings.roster.rosterSize", `expected ${lineupSlotCount} to match lineup slots.`);
  }

  return {
    expectedTeamCount: teamCount,
    auction: {
      budgetDollars: integerAt(auction.budgetDollars, "season.settings.auction.budgetDollars", 1),
      minimumBidDollars: integerAt(auction.minimumBidDollars, "season.settings.auction.minimumBidDollars", 1),
    },
    roster: { rosterSize, lineup, lineupSlotCount, rosterMaximums: rosterMaximumsAt(roster.rosterMaximums) },
    keeperPolicy: {
      mode: enumAt(keeperPolicy.mode, keeperPolicyModes, "season.settings.keeperPolicy.mode"),
      multiplier: positiveNumberAt(keeperPolicy.multiplier, "season.settings.keeperPolicy.multiplier"),
      rounding: enumAt(keeperPolicy.rounding, keeperPolicyRoundings, "season.settings.keeperPolicy.rounding"),
    },
  };
};
