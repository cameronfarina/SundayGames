import { positions } from "../../../config/league.js";
import type { LeagueSeasonReadinessCheck, RosterRules } from "./contracts.js";

export const validateRosterSlots = (rules: RosterRules): LeagueSeasonReadinessCheck => {
  const entries = Object.entries(rules.lineup);
  const validCounts = Number.isInteger(rules.rosterSize) && rules.rosterSize > 0
    && Number.isInteger(rules.lineupSlotCount) && rules.lineupSlotCount > 0
    && entries.length > 0
    && entries.every(([slot, count]) => slot.trim().length > 0 && Number.isInteger(count) && count > 0);
  const actualCount = entries.reduce((total, [, count]) => total + count, 0);
  const declaredCountsMatch = actualCount === rules.lineupSlotCount;
  const rosterMatches = rules.rosterSize === rules.lineupSlotCount;
  let message = `${rules.rosterSize} roster slots match the lineup settings.`;
  if (!validCounts || !declaredCountsMatch) {
    message = "Roster size and every lineup slot must be positive whole numbers, and lineup slots must total the roster size.";
  } else if (!rosterMatches) {
    message = `Roster size is ${rules.rosterSize}, but lineup slots add up to ${rules.lineupSlotCount}.`;
  }
  return {
    key: "roster-slots", label: "Roster slots",
    status: validCounts && declaredCountsMatch && rosterMatches ? "pass" : "fail",
    severity: "blocker", message,
  };
};

export const validateRosterMaximums = (rules: RosterRules): LeagueSeasonReadinessCheck => {
  const maximums = positions.map(position => rules.rosterMaximums[position]);
  const valid = maximums.every(maximum => Number.isInteger(maximum) && maximum >= 0);
  const fillsRoster = maximums.reduce((total, maximum) => total + maximum, 0) >= rules.rosterSize;
  const fitsSlots = positions.every(position => {
    const slotCount = rules.lineup[position];
    return slotCount === undefined || slotCount <= rules.rosterMaximums[position];
  });
  const passes = valid && fillsRoster && fitsSlots;
  return {
    key: "roster-maximums", label: "Roster maximums", status: passes ? "pass" : "fail",
    severity: "blocker",
    message: passes ? "Roster maximums are configured for every position."
      : "Roster maximums must be non-negative whole numbers and must support a full roster.",
  };
};
