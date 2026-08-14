import type {
  ProductionProvisioningContext,
  ProductionProvisioningInspection,
  ResolvedProductionProvisioningDocument,
} from "../productionProvisioning.js";
import type { InspectionPart, ProductionProvisioningDependencies } from "./contracts.js";
import { inspectAccounts } from "./inspectAccounts.js";
import { inspectAudit } from "./inspectAudit.js";
import { inspectDraftSetup } from "./inspectDraftSetup.js";
import { inspectKeepers } from "./inspectKeepers.js";
import { inspectPlayers } from "./inspectPlayers.js";
import { inspectSeason } from "./inspectSeason.js";

export const inspectProvisioning = async (
  document: ResolvedProductionProvisioningDocument,
  context: ProductionProvisioningContext,
  dependencies: ProductionProvisioningDependencies,
): Promise<ProductionProvisioningInspection> => {
  const parts: InspectionPart[] = [];
  parts.push(await inspectAccounts(document, dependencies));
  parts.push(await inspectSeason(document, dependencies));
  parts.push(await inspectDraftSetup(document, dependencies));
  parts.push(await inspectPlayers(document, dependencies));
  parts.push(await inspectKeepers(document, dependencies));
  const audit = await inspectAudit(context, dependencies);

  return {
    changes: [...parts.flatMap(part => part.changes), audit.change],
    conflicts: parts.flatMap(part => part.conflicts),
    auditRecorded: audit.auditRecorded,
  };
};
