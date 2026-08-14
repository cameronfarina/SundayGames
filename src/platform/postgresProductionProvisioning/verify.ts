import type {
  ProductionProvisioningContext,
  ResolvedProductionProvisioningDocument,
} from "../productionProvisioning.js";
import type { ProductionProvisioningDependencies } from "./contracts.js";
import { inspectProvisioning } from "./inspect.js";

export const verifyProvisioning = async (
  document: ResolvedProductionProvisioningDocument,
  context: ProductionProvisioningContext,
  dependencies: ProductionProvisioningDependencies,
): Promise<readonly string[]> => {
  const inspection = await inspectProvisioning(document, context, dependencies);
  return [
    ...inspection.conflicts,
    ...inspection.changes
      .filter(candidate => candidate.action !== "unchanged")
      .map(candidate => `${candidate.resourceType} ${candidate.resourceId} requires ${candidate.action}.`),
    ...(inspection.auditRecorded ? [] : [`Audit event ${context.auditEventId} is missing.`]),
  ];
};
