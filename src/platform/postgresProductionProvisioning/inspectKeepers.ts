import type { ResolvedProductionProvisioningDocument } from "../productionProvisioning.js";
import { sameCanonicalValue } from "./canonicalValue.js";
import { provisioningChange } from "./change.js";
import type { InspectionPart, KeeperRow, ProductionProvisioningDependencies } from "./contracts.js";

export const inspectKeepers = async (
  document: ResolvedProductionProvisioningDocument,
  dependencies: ProductionProvisioningDependencies,
): Promise<InspectionPart> => {
  const result = await dependencies.client.query<KeeperRow>(`
SELECT id, fantasy_team_id, player_id, player_name, position, keeper_cost,
       previous_cost, status, source
FROM keeper_declarations
WHERE league_season_id = $1
ORDER BY id ASC
`.trim(), [document.season.id]);
  const keepersById = new Map(result.rows.map(keeper => [keeper.id, keeper]));
  const changes = [];
  const conflicts: string[] = [];
  if (result.rows.some(row => !document.keepers.some(keeper => keeper.id === row.id))) {
    conflicts.push(`Season ${document.season.id} has keeper declarations outside the provisioning document.`);
  }

  const catalogById = new Map(document.catalog.map(player => [player.playerId, player]));
  for (const keeper of document.keepers) {
    const player = catalogById.get(keeper.playerId);
    if (player === undefined) throw new Error(`Missing catalog player ${keeper.playerId}.`);
    const expected: KeeperRow = {
      id: keeper.id,
      fantasy_team_id: keeper.teamId,
      player_id: keeper.playerId,
      player_name: player.name,
      position: player.position,
      keeper_cost: keeper.keeperCost,
      previous_cost: keeper.previousCost ?? null,
      status: keeper.status,
      source: keeper.source,
    };
    const existing = keepersById.get(keeper.id);
    if (existing === undefined) {
      changes.push(provisioningChange("keeper", keeper.id, "create"));
    } else if (sameCanonicalValue(existing, expected)) {
      changes.push(provisioningChange("keeper", keeper.id, "unchanged"));
    } else {
      conflicts.push(`Keeper ${keeper.id} differs from the provisioning document.`);
      changes.push(provisioningChange("keeper", keeper.id, "unchanged"));
    }
  }

  return { changes, conflicts };
};
