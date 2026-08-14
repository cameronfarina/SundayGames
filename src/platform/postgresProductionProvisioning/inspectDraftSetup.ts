import { liveDraftRoomSetupContentHash } from "../liveDraftRoomSetups.js";
import type { ResolvedProductionProvisioningDocument } from "../productionProvisioning.js";
import { provisioningChange } from "./change.js";
import type { InspectionPart, ProductionProvisioningDependencies } from "./contracts.js";
import { draftSetupInputFor } from "./documentValues.js";

export const inspectDraftSetup = async (
  document: ResolvedProductionProvisioningDocument,
  dependencies: ProductionProvisioningDependencies,
): Promise<InspectionPart> => {
  const input = draftSetupInputFor(document);
  const existing = await dependencies.draftSetupRepository.findForSeason(document.season.id);
  if (existing === null) {
    return {
      changes: [provisioningChange("season-draft-setup", document.season.id, "create")],
      conflicts: [],
    };
  }
  if (
    existing.sourceVersion === input.sourceVersion
    && existing.contentHash === liveDraftRoomSetupContentHash(input)
  ) {
    return {
      changes: [provisioningChange("season-draft-setup", document.season.id, "unchanged")],
      conflicts: [],
    };
  }

  return {
    changes: [provisioningChange("season-draft-setup", document.season.id, "unchanged")],
    conflicts: [`Season draft setup ${document.season.id} differs from the provisioning document.`],
  };
};
