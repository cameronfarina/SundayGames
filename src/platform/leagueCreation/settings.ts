import type {
  AuctionLeagueSeasonSettings,
  KeeperPolicy,
  RosterRules,
  SnakeLeagueSeasonSettings,
} from "../leagueSeason.js";
import { LeagueCreationError } from "./errors.js";
import { analyzeRosterSlots, lineupFor } from "./roster.js";
import type { ConfirmedLeagueCreationInput } from "./types.js";

const keeperPolicy = (): KeeperPolicy => ({
  mode: "previous-cost-multiplier",
  multiplier: 1.2,
  rounding: "ceil",
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
      keeperPolicy: keeperPolicy(),
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
    keeperPolicy: keeperPolicy(),
    snake: {
      rounds: input.draft.rounds,
      reversal: input.draft.reversal ?? "standard",
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
