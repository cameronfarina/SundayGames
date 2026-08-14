import type {
  ProductionProvisioningContext,
  ResolvedProductionProvisioningDocument,
} from "../productionProvisioning.js";
import type { ProductionProvisioningDependencies } from "./contracts.js";

export const applySeason = async (
  document: ResolvedProductionProvisioningDocument,
  context: ProductionProvisioningContext,
  dependencies: ProductionProvisioningDependencies,
): Promise<void> => {
  const existing = await dependencies.leagueSetupRepository.findLeagueSeason(document.season.id);
  if (existing !== null) return;
  await dependencies.leagueSetupRepository.registerLeagueSeason({
    season: document.season,
    memberships: document.memberships,
    createdByUserId: document.actorAccountId,
    now: context.now,
  });
};
