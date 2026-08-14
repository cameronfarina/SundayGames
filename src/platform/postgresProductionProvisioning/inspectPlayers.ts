import type { ResolvedProductionProvisioningDocument } from "../productionProvisioning.js";
import { sameCanonicalValue } from "./canonicalValue.js";
import { provisioningChange } from "./change.js";
import type { InspectionPart, PlayerRow, ProductionProvisioningDependencies } from "./contracts.js";

export const inspectPlayers = async (
  document: ResolvedProductionProvisioningDocument,
  dependencies: ProductionProvisioningDependencies,
): Promise<InspectionPart> => {
  const result = await dependencies.client.query<PlayerRow>(`
SELECT id, provider, provider_player_id, canonical_name, position, nfl_team, bye_week, active
FROM players
WHERE id = ANY($1::text[])
`.trim(), [document.catalog.map(player => player.playerId)]);
  const playersById = new Map(result.rows.map(player => [player.id, player]));
  const changes = [];
  const conflicts: string[] = [];

  for (const player of document.catalog) {
    const existing = playersById.get(player.playerId);
    if (existing === undefined) {
      changes.push(provisioningChange("player", player.playerId, "create"));
      continue;
    }
    const expected: PlayerRow = {
      id: player.playerId,
      provider: player.provider ?? null,
      provider_player_id: player.providerPlayerId ?? null,
      canonical_name: player.name,
      position: player.position,
      nfl_team: player.teamAbbreviation ?? null,
      bye_week: player.byeWeek ?? null,
      active: true,
    };
    if (sameCanonicalValue(existing, expected)) {
      changes.push(provisioningChange("player", player.playerId, "unchanged"));
    } else {
      conflicts.push(`Player ${player.playerId} differs from the provisioning document.`);
      changes.push(provisioningChange("player", player.playerId, "unchanged"));
    }
  }

  return { changes, conflicts };
};
