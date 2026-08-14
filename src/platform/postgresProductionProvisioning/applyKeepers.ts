import type {
  ProductionProvisioningContext,
  ResolvedProductionProvisioningDocument,
} from "../productionProvisioning.js";
import type { ProductionProvisioningDependencies } from "./contracts.js";

export const applyKeepers = async (
  document: ResolvedProductionProvisioningDocument,
  context: ProductionProvisioningContext,
  dependencies: ProductionProvisioningDependencies,
): Promise<void> => {
  const catalogById = new Map(document.catalog.map(player => [player.playerId, player]));
  for (const keeper of document.keepers) {
    const player = catalogById.get(keeper.playerId);
    if (player === undefined) throw new Error(`Missing catalog player ${keeper.playerId}.`);
    await dependencies.client.query(`
INSERT INTO keeper_declarations (
  id, league_season_id, fantasy_team_id, player_id, player_name, position,
  keeper_cost, previous_cost, status, source, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
ON CONFLICT (id) DO NOTHING;
`.trim(), [
      keeper.id,
      document.season.id,
      keeper.teamId,
      keeper.playerId,
      player.name,
      player.position,
      keeper.keeperCost,
      keeper.previousCost ?? null,
      keeper.status,
      keeper.source,
      context.now,
    ]);
  }
};
