import { leagueConfig } from "../../../config/league.js";
import type { KeeperScenario } from "../keeperInflation.js";
import type {
  LiveDraftEvent,
  LiveDraftOwnerState,
  LiveDraftRoomState,
} from "./contracts.js";
import type { LiveDraftPlayerRecord } from "./internalTypes.js";
import { roundToTwo } from "./numbers.js";

export const draftableExpectedSpend = (
  records: readonly LiveDraftPlayerRecord[],
  soldNames: ReadonlySet<string>,
  remainingRosterSlots: number,
): number => records
  .filter(record => !soldNames.has(record.normalizedName))
  .sort((left, right) =>
    right.expectedPrice - left.expectedPrice
    || right.weeks1To4 - left.weeks1To4
    || left.name.localeCompare(right.name))
  .slice(0, remainingRosterSlots)
  .reduce((total, player) => total + player.expectedPrice, 0);

export const rawLiveInflationFactorFor = ({
  remainingBudget,
  remainingExpectedSpend,
  remainingRosterSlots,
}: Pick<LiveDraftRoomState, "remainingBudget" | "remainingExpectedSpend" | "remainingRosterSlots">): number => {
  if (remainingRosterSlots <= 0) return 0;
  return remainingBudget / Math.max(remainingRosterSlots, remainingExpectedSpend);
};

export const buildRoomState = ({
  scenario,
  owners,
  events,
  records,
  soldNames,
  initialKeeperSpend,
  startingLiveInflationFactor,
}: {
  scenario: KeeperScenario;
  owners: readonly LiveDraftOwnerState[];
  events: readonly LiveDraftEvent[];
  records: readonly LiveDraftPlayerRecord[];
  soldNames: ReadonlySet<string>;
  initialKeeperSpend: number;
  startingLiveInflationFactor: number;
}): LiveDraftRoomState => {
  const actualAuctionSpend = events.reduce((total, event) => total + event.price, 0);
  const expectedAuctionSpend = events.reduce((total, event) => total + event.expectedPrice, 0);
  const remainingBudget = owners.reduce((total, owner) => total + owner.budgetRemaining, 0);
  const remainingRosterSlots = owners.reduce((total, owner) => total + owner.rosterSlotsRemaining, 0);
  const remainingExpectedSpend = draftableExpectedSpend(records, soldNames, remainingRosterSlots);
  const rawLiveInflationFactor = rawLiveInflationFactorFor({
    remainingBudget,
    remainingExpectedSpend,
    remainingRosterSlots,
  });

  return {
    scenarioKey: scenario.key,
    totalBudget: leagueConfig.teams * leagueConfig.auctionBudget,
    initialKeeperSpend,
    actualAuctionSpend,
    expectedAuctionSpend,
    saleVsExpected: actualAuctionSpend - expectedAuctionSpend,
    remainingBudget,
    remainingRosterSlots,
    remainingExpectedSpend,
    liveInflationFactor: roundToTwo(rawLiveInflationFactor / Math.max(0.01, startingLiveInflationFactor)),
  };
};
