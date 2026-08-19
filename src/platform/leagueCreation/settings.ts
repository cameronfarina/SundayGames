import type {
  AuctionLeagueSeasonSettings,
  KeeperPolicy,
  RosterRules,
  SnakeLeagueSeasonSettings,
} from "../leagueSeason.js";
import { LeagueCreationError } from "./errors.js";
import { analyzeRosterSlots, lineupFor } from "./roster.js";
import type { ConfirmedLeagueCreationInput } from "./types.js";

const keeperPolicy = (enabled: boolean): KeeperPolicy => ({
  mode: "previous-cost-multiplier",
  multiplier: 1.2,
  rounding: "ceil",
  ...(enabled ? {} : { enabled: false }),
});

const rosterRulesFor = (input: ConfirmedLeagueCreationInput): RosterRules => {
  const lineup = lineupFor(input.rosterSlots);
  const analysis = analyzeRosterSlots(lineup);
  return {
    rosterSize: analysis.draftCapacity,
    lineup,
    lineupSlotCount: analysis.draftCapacity,
    rosterMaximums: analysis.rosterMaximums,
  };
};

export const settingsFor = (
  input: ConfirmedLeagueCreationInput,
  teamIdByExternalId: ReadonlyMap<string, string>,
): AuctionLeagueSeasonSettings | SnakeLeagueSeasonSettings => {
  const roster = rosterRulesFor(input);
  if (input.draft.type === "auction") {
    return {
      draftFormat: "auction",
      expectedTeamCount: input.expectedTeamCount,
      scoring: { ...input.scoring },
      roster,
      keeperPolicy: keeperPolicy(input.keeperLeague !== false),
      auction: {
        budgetDollars: input.draft.budgetDollars,
        minimumBidDollars: input.draft.minimumBidDollars,
      },
    };
  }
  return {
    draftFormat: "snake",
    expectedTeamCount: input.expectedTeamCount,
    scoring: { ...input.scoring },
    roster,
    keeperPolicy: keeperPolicy(input.keeperLeague !== false),
    snake: {
      rounds: input.draft.rounds,
      order: input.draft.order.map(externalTeamId => {
        const teamId = teamIdByExternalId.get(externalTeamId.trim());
        if (teamId === undefined) {
          throw new LeagueCreationError(`Snake order references unknown team ${externalTeamId}.`);
        }
        return teamId;
      }),
    },
  };
};
