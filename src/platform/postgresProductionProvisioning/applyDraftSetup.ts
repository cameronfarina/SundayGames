import type {
  ProductionProvisioningContext,
  ResolvedProductionProvisioningDocument,
} from "../productionProvisioning.js";
import type { ProductionProvisioningDependencies } from "./contracts.js";
import { draftSetupInputFor } from "./documentValues.js";

export const applyDraftSetup = async (
  document: ResolvedProductionProvisioningDocument,
  context: ProductionProvisioningContext,
  dependencies: ProductionProvisioningDependencies,
): Promise<void> => {
  const existing = await dependencies.draftSetupRepository.findForSeason(document.season.id);
  if (existing !== null) return;
  await dependencies.draftSetupRepository.save({
    ...draftSetupInputFor(document),
    updatedAt: context.now,
  });
};
