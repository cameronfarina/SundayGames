import { keepers } from "../../../config/keepers.js";
import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type { FantasyTeam } from "../leagueSeason.js";
import type { ProductionOwnerAccountMappingDocument, ResolvedKeeperRecord } from "./contracts.js";
import type { ProvisioningCatalog } from "./catalog.js";
import { keeperSelectionKey } from "./keeperSelections.js";

export const buildKeeperRecords = (
  document: ProductionOwnerAccountMappingDocument,
  teams: readonly FantasyTeam[],
  catalog: ProvisioningCatalog,
): readonly ResolvedKeeperRecord[] => {
  const teamByOwner = new Map(teams.map(team => [team.ownerDisplayName, team]));
  const selectedKeys = new Set(document.selectedKeepers.map(keeperSelectionKey));
  return keepers.filter(keeper => selectedKeys.has(keeperSelectionKey(keeper))).map(keeper => {
    const team = teamByOwner.get(keeper.owner);
    if (team === undefined) throw new Error(`Current keeper references unknown owner ${keeper.owner}.`);
    const player = catalog.byIdentity.get(canonicalPlayerIdentityKey(keeper.player));
    if (player === undefined) {
      throw new Error(`Current keeper ${keeper.player} is missing from the current catalog.`);
    }
    return { keeper, team, player };
  });
};
