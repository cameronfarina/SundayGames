import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import { loadCurrentProjections, type ProjectionRecord } from "../../projections.js";
import { loadCurrentPlayerCatalog } from "../localDemoFixtures.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../liveDraftRooms.js";
import type { ProductionProvisioningCatalogEntry } from "../productionProvisioning.js";
import { currentProjectionPath } from "./constants.js";
import { provisioningSlug } from "./slug.js";

export interface ProvisioningCatalog {
  entries: readonly ProductionProvisioningCatalogEntry[];
  byIdentity: ReadonlyMap<string, ProductionProvisioningCatalogEntry>;
}

export const createProvisioningCatalog = (
  currentCatalog: readonly LiveDraftRoomPlayerCatalogEntry[],
  projections: readonly ProjectionRecord[],
): ProvisioningCatalog => {
  const projectionByIdentity = new Map(
    projections.map(projection => [canonicalPlayerIdentityKey(projection.name), projection]),
  );
  const entries = currentCatalog.map((player): ProductionProvisioningCatalogEntry => {
    const identity = canonicalPlayerIdentityKey(player.name);
    const projection = projectionByIdentity.get(identity);
    return {
      playerId: projection === undefined ? `player-${provisioningSlug(identity)}` : `player-espn-${projection.id}`,
      name: player.name,
      position: player.position,
      expectedPrice: player.expectedPrice,
      provider: projection === undefined ? "mockd" : "espn",
      ...(projection === undefined ? {} : { providerPlayerId: String(projection.id) }),
      ...(player.teamAbbreviation === undefined ? {} : { teamAbbreviation: player.teamAbbreviation }),
      ...(player.byeWeek === undefined ? {} : { byeWeek: player.byeWeek }),
    };
  });
  const byIdentity = new Map(entries.map(player => [canonicalPlayerIdentityKey(player.name), player]));
  if (byIdentity.size !== entries.length) {
    throw new Error("Current player catalog contains duplicate canonical player identities.");
  }
  if (new Set(entries.map(player => player.playerId)).size !== entries.length) {
    throw new Error("Current player catalog produces duplicate deterministic player IDs.");
  }
  return { entries, byIdentity };
};

export const buildProvisioningCatalog = async (): Promise<ProvisioningCatalog> => {
  const [currentCatalog, projections] = await Promise.all([
    loadCurrentPlayerCatalog(),
    loadCurrentProjections({ projectionPath: currentProjectionPath }),
  ]);
  return createProvisioningCatalog(currentCatalog, projections);
};
