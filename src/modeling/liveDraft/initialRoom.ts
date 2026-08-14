import type { Owner } from "../../../config/league.js";
import type { LiveDraftRosterPlayer } from "./contracts.js";
import type { LiveDraftPlayerRecord } from "./internalTypes.js";
import { buildOwnerStates } from "./rosters.js";
import { draftableExpectedSpend, rawLiveInflationFactorFor } from "./roomState.js";

export const startingLiveInflationFactorFor = ({
  records,
  soldNames,
  rostersByOwner,
}: {
  records: readonly LiveDraftPlayerRecord[];
  soldNames: ReadonlySet<string>;
  rostersByOwner: ReadonlyMap<Owner, readonly LiveDraftRosterPlayer[]>;
}): number => {
  const owners = buildOwnerStates(rostersByOwner);
  const remainingRosterSlots = owners.reduce(
    (total, owner) => total + owner.rosterSlotsRemaining,
    0,
  );
  return rawLiveInflationFactorFor({
    remainingBudget: owners.reduce((total, owner) => total + owner.budgetRemaining, 0),
    remainingExpectedSpend: draftableExpectedSpend(records, soldNames, remainingRosterSlots),
    remainingRosterSlots,
  });
};
