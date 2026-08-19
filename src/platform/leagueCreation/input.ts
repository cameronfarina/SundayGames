import { LeagueCreationError } from "./errors.js";
import { numberField, recordValue, stringArray, stringField } from "./inputFields.js";
import type {
  ConfirmedLeagueCreationInput,
  ConfirmedLeagueDraftInput,
  ConfirmedLeagueTeamInput,
} from "./types.js";

const teamsFrom = (values: unknown[]): ConfirmedLeagueTeamInput[] => values.map((value, index) => {
  const team = recordValue(value, `Team ${index + 1}`);
  const managerNames = team.managerNames === undefined ? undefined : stringArray(team.managerNames);
  if (team.managerNames !== undefined && managerNames === null) {
    throw new LeagueCreationError(`Team ${index + 1} managers are invalid.`);
  }
  return {
    externalTeamId: stringField(team, "externalTeamId", `Team ${index + 1} external ID`),
    displayName: stringField(team, "displayName", `Team ${index + 1} name`),
    ...(typeof team.abbreviation === "string" ? { abbreviation: team.abbreviation } : {}),
    ...(managerNames === undefined || managerNames === null ? {} : { managerNames }),
  };
});

const draftFrom = (value: unknown): ConfirmedLeagueDraftInput => {
  const draft = recordValue(value, "Draft settings");
  if (draft.type === "auction") {
    return {
      type: "auction",
      budgetDollars: numberField(draft, "budgetDollars", "Auction budget"),
      minimumBidDollars: numberField(draft, "minimumBidDollars", "Auction minimum bid"),
    };
  }
  if (draft.type !== "snake") throw new LeagueCreationError("Draft type must be auction or snake.");
  const order = stringArray(draft.order);
  if (order === null) throw new LeagueCreationError("Snake draft order is invalid.");
  return {
    type: "snake",
    rounds: numberField(draft, "rounds", "Snake rounds"),
    order,
  };
};

export const confirmedLeagueCreationInputFromUnknown = (
  value: unknown,
): ConfirmedLeagueCreationInput => {
  const input = recordValue(value, "League setup");
  const provider = input.provider;
  if (provider !== "mockd" && provider !== "espn" && provider !== "sleeper" && provider !== "yahoo") {
    throw new LeagueCreationError("League provider is invalid.");
  }
  if (!Array.isArray(input.teams)) throw new LeagueCreationError("League teams are required.");
  if (input.keeperLeague !== undefined && typeof input.keeperLeague !== "boolean") {
    throw new LeagueCreationError("Keeper league flag is invalid.");
  }
  const scoring = recordValue(input.scoring, "Scoring settings");
  const rosterSlotsRecord = recordValue(input.rosterSlots, "Roster slots");
  const rosterSlots = Object.fromEntries(Object.entries(rosterSlotsRecord).map(([slot, count]) => {
    if (typeof count !== "number") throw new LeagueCreationError(`Roster slot ${slot} is invalid.`);
    return [slot, count];
  }));

  return {
    provider,
    externalLeagueId: stringField(input, "externalLeagueId", "External league ID"),
    leagueName: stringField(input, "leagueName", "League name"),
    seasonYear: numberField(input, "seasonYear", "Season"),
    expectedTeamCount: numberField(input, "expectedTeamCount", "Team count"),
    ...(input.keeperLeague === undefined ? {} : { keeperLeague: input.keeperLeague }),
    teams: teamsFrom(input.teams),
    draft: draftFrom(input.draft),
    scoring: {
      passingYards: numberField(scoring, "passingYards", "Passing yard scoring"),
      passingTouchdown: numberField(scoring, "passingTouchdown", "Passing touchdown scoring"),
      rushingYards: numberField(scoring, "rushingYards", "Rushing yard scoring"),
      rushingTouchdown: numberField(scoring, "rushingTouchdown", "Rushing touchdown scoring"),
      receivingYards: numberField(scoring, "receivingYards", "Receiving yard scoring"),
      receivingTouchdown: numberField(scoring, "receivingTouchdown", "Receiving touchdown scoring"),
      reception: numberField(scoring, "reception", "Reception scoring"),
    },
    rosterSlots,
  };
};
