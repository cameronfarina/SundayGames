import type {
  ProductionProvisioningContext,
  ResolvedProductionProvisioningDocument,
} from "../productionProvisioning.js";
import type { ProductionProvisioningDependencies } from "./contracts.js";

export const applyPlayers = async (
  document: ResolvedProductionProvisioningDocument,
  context: ProductionProvisioningContext,
  dependencies: ProductionProvisioningDependencies,
): Promise<void> => {
  for (const player of document.catalog) {
    await dependencies.client.query(`
INSERT INTO players (
  id, provider, provider_player_id, canonical_name, position, nfl_team,
  bye_week, active, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $8)
ON CONFLICT (id) DO NOTHING;
`.trim(), [
      player.playerId,
      player.provider ?? null,
      player.providerPlayerId ?? null,
      player.name,
      player.position,
      player.teamAbbreviation ?? null,
      player.byeWeek ?? null,
      context.now,
    ]);
  }
};
