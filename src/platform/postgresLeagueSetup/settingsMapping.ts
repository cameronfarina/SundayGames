import type {
  KeeperPolicy,
  LeagueSeason,
  LeagueSeasonDraftSchedule,
  LineupSettings,
  RosterMaximums,
  RosterRules,
  ScoringSettings,
  SnakeSettings,
} from "../leagueSeason.js";
import { defaultScoringSettings } from "../leagueSeason.js";
import {
  defaultKeeperPolicy,
  defaultLineup,
  defaultRosterMaximums,
} from "./defaults.js";
import {
  jsonObjectFromDb,
  numberFromObject,
  stringArrayFromDb,
  stringFromObject,
} from "./databaseValues.js";

export const lineupFromDb = (value: unknown): LineupSettings => {
  const candidate = jsonObjectFromDb(jsonObjectFromDb(value).lineup);
  const lineup: LineupSettings = {};
  for (const [slot, count] of Object.entries(candidate)) {
    if (typeof count === "number" && Number.isFinite(count) && count >= 0) lineup[slot] = count;
  }
  return Object.keys(lineup).length === 0 ? { ...defaultLineup } : lineup;
};

export const rosterMaximumsFromDb = (value: unknown): RosterMaximums => {
  const record = jsonObjectFromDb(value);
  return {
    QB: numberFromObject(record, "QB", defaultRosterMaximums.QB),
    RB: numberFromObject(record, "RB", defaultRosterMaximums.RB),
    WR: numberFromObject(record, "WR", defaultRosterMaximums.WR),
    TE: numberFromObject(record, "TE", defaultRosterMaximums.TE),
    K: numberFromObject(record, "K", defaultRosterMaximums.K),
    DST: numberFromObject(record, "DST", defaultRosterMaximums.DST),
  };
};

export const keeperPolicyFromDb = (value: unknown): KeeperPolicy => {
  const policy = jsonObjectFromDb(jsonObjectFromDb(value).keeperPolicy);
  if (
    policy.mode === "previous-cost-multiplier" &&
    typeof policy.multiplier === "number" &&
    policy.rounding === "ceil"
  ) {
    return { mode: "previous-cost-multiplier", multiplier: policy.multiplier, rounding: "ceil" };
  }
  return { ...defaultKeeperPolicy };
};

export const scoringFromDb = (value: unknown): ScoringSettings => {
  const record = jsonObjectFromDb(value);
  return {
    passingYards: numberFromObject(record, "passingYards", defaultScoringSettings.passingYards),
    passingTouchdown: numberFromObject(record, "passingTouchdown", defaultScoringSettings.passingTouchdown),
    rushingYards: numberFromObject(record, "rushingYards", defaultScoringSettings.rushingYards),
    rushingTouchdown: numberFromObject(record, "rushingTouchdown", defaultScoringSettings.rushingTouchdown),
    receivingYards: numberFromObject(record, "receivingYards", defaultScoringSettings.receivingYards),
    receivingTouchdown: numberFromObject(record, "receivingTouchdown", defaultScoringSettings.receivingTouchdown),
    reception: numberFromObject(record, "reception", defaultScoringSettings.reception),
  };
};

export const snakeSettingsFromDb = (value: unknown): SnakeSettings => {
  const record = jsonObjectFromDb(value);
  return {
    rounds: numberFromObject(record, "rounds", 0),
    order: stringArrayFromDb(record.order),
    reversal: record.reversal === "third-round" ? "third-round" : "standard",
  };
};

export const draftScheduleFromDb = (value: unknown): LeagueSeasonDraftSchedule | undefined => {
  const draft = jsonObjectFromDb(jsonObjectFromDb(value).draft);
  const scheduledAt = stringFromObject(draft, "scheduledAt");
  const timezone = stringFromObject(draft, "timezone");
  if (scheduledAt === undefined && timezone === undefined) return undefined;
  return {
    ...(scheduledAt === undefined ? {} : { scheduledAt }),
    ...(timezone === undefined ? {} : { timezone }),
  };
};

export const settingsJsonFor = (season: LeagueSeason): Record<string, unknown> => ({
  expectedTeamCount: season.settings.expectedTeamCount,
  keeperPolicy: season.settings.keeperPolicy,
  ...(season.draft === undefined ? {} : { draft: season.draft }),
});

export const slotsJsonFor = (rules: RosterRules): Record<string, unknown> => ({
  rosterSize: rules.rosterSize,
  lineup: rules.lineup,
  lineupSlotCount: rules.lineupSlotCount,
});
