import type { Owner } from "../../../config/league.js";
import type { KeeperScenario } from "../keeperInflation.js";
import type { LiveDraftStrategyDefinition } from "../liveDraftStrategies.js";
import type { PricingConfig } from "../basePricing.js";
import type {
  LiveDraftCommandError,
  LiveDraftEvent,
  LiveDraftRosterPlayer,
  LiveDraftSaleAudit,
} from "./contracts.js";
import type { LiveDraftPlayerRecord } from "./internalTypes.js";
import { roundPrice } from "./numbers.js";
import { resolveSale } from "./saleResolution.js";
import { saleAuditFor } from "./saleAudit.js";
import { buildOwnerStates, livePlayerForRoster, ownerStateFor, validateSaleFitsOwner } from "./rosters.js";
import { buildRoomState } from "./roomState.js";
import { canWatchOwnerRosterPlayer, personalValueForStrategy } from "./strategyValuation.js";

export interface ReplayCommandsResult {
  events: LiveDraftEvent[];
  postDraftAudit: LiveDraftSaleAudit[];
  errors: LiveDraftCommandError[];
}

export const replayCommands = ({
  commands, records, rostersByOwner, soldNames, watchOwner, scenario,
  initialKeeperSpend, startingLiveInflationFactor, strategy, pricingConfig,
}: {
  commands: readonly string[];
  records: readonly LiveDraftPlayerRecord[];
  rostersByOwner: Map<Owner, LiveDraftRosterPlayer[]>;
  soldNames: Set<string>;
  watchOwner: Owner;
  scenario: KeeperScenario;
  initialKeeperSpend: number;
  startingLiveInflationFactor: number;
  strategy: LiveDraftStrategyDefinition;
  pricingConfig: PricingConfig;
}): ReplayCommandsResult => {
  const events: LiveDraftEvent[] = [];
  const postDraftAudit: LiveDraftSaleAudit[] = [];
  const errors: LiveDraftCommandError[] = [];

  for (const input of commands) {
    try {
      const sale = resolveSale(input, records);
      if (soldNames.has(sale.player.normalizedName)) {
        throw new Error(`${sale.player.name} is already unavailable.`);
      }
      const roster = rostersByOwner.get(sale.owner) ?? [];
      validateSaleFitsOwner(sale, ownerStateFor(sale.owner, roster));
      const owners = buildOwnerStates(rostersByOwner);
      const room = buildRoomState({
        scenario, owners, events, records, soldNames, initialKeeperSpend, startingLiveInflationFactor,
      });
      const watched = owners.find(owner => owner.owner === watchOwner);
      if (!watched) throw new Error(`Unknown watch owner "${watchOwner}".`);
      const liveExpectedPrice = roundPrice(sale.player.expectedPrice * room.liveInflationFactor);
      const personalValue = canWatchOwnerRosterPlayer(sale.player, watched)
        ? personalValueForStrategy({
          player: sale.player,
          watchOwner: watched,
          liveExpectedPrice,
          strategy,
          pricingConfig,
        })
        : 0;
      roster.push(livePlayerForRoster(sale.player, sale.parsed.price));
      rostersByOwner.set(sale.owner, roster);
      soldNames.add(sale.player.normalizedName);
      events.push({
        input,
        owner: sale.owner,
        player: sale.player.name,
        normalizedPlayerName: sale.player.normalizedName,
        position: sale.player.position,
        price: sale.parsed.price,
        expectedPrice: sale.player.expectedPrice,
        saleVsExpected: sale.parsed.price - sale.player.expectedPrice,
        playerSource: sale.player.source,
      });
      postDraftAudit.push(saleAuditFor({ input, sale, liveExpectedPrice, personalValue }));
    } catch (error) {
      errors.push({
        input,
        message: error instanceof Error ? error.message : "Unknown live draft command error.",
      });
    }
  }
  return { events, postDraftAudit, errors };
};
