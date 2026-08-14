import type {
  ExecuteProductionProvisioningOptions,
  ProductionProvisioningContext,
  ProductionProvisioningResult,
} from "./contracts.js";
import { digestFor, resolveDocument } from "./resolveDocument.js";

const resultFor = (
  options: ExecuteProductionProvisioningOptions,
  context: ProductionProvisioningContext,
  inputDigest: string,
  status: ProductionProvisioningResult["status"],
  changes: ProductionProvisioningResult["changes"],
): ProductionProvisioningResult => ({
  mode: options.mode,
  status,
  provisioningId: options.document.provisioningId,
  inputDigest,
  auditEventId: context.auditEventId,
  changes,
});

export const executeProductionProvisioning = async (
  options: ExecuteProductionProvisioningOptions,
): Promise<ProductionProvisioningResult> => {
  const document = resolveDocument(options.document, options.env ?? process.env);
  const inputDigest = digestFor(document);
  const context: ProductionProvisioningContext = {
    inputDigest,
    auditEventId: `production-provisioning:${document.provisioningId}:${inputDigest}`,
    now: options.now ?? new Date(),
  };
  const inspection = await options.repository.inspect(document, context);
  if (inspection.conflicts.length > 0) {
    throw new Error(`Production provisioning conflicts:\n- ${inspection.conflicts.join("\n- ")}`);
  }
  if (inspection.auditRecorded && inspection.changes.some(change => change.action !== "unchanged")) {
    throw new Error(
      `Production provisioning audit receipt exists, but state differs for ${document.provisioningId}. Run --verify and investigate the drift.`,
    );
  }

  if (options.mode === "apply") {
    const alreadyApplied = inspection.auditRecorded
      && inspection.changes.every(change => change.action === "unchanged");
    if (!alreadyApplied) {
      await options.repository.apply(document, context);
      const issues = await options.repository.verify(document, context);
      if (issues.length > 0) {
        throw new Error(`Production provisioning verification failed after apply:\n- ${issues.join("\n- ")}`);
      }
    }
    return resultFor(
      options,
      context,
      inputDigest,
      alreadyApplied ? "unchanged" : "applied",
      inspection.changes,
    );
  }

  if (options.mode === "verify") {
    const issues = [
      ...inspection.changes
        .filter(change => change.action !== "unchanged")
        .map(change => `${change.resourceType} ${change.resourceId} requires ${change.action}.`),
      ...(inspection.auditRecorded ? [] : [`Audit event ${context.auditEventId} is missing.`]),
      ...await options.repository.verify(document, context),
    ];
    if (issues.length > 0) {
      throw new Error(`Production provisioning verification failed:\n- ${issues.join("\n- ")}`);
    }
    return resultFor(options, context, inputDigest, "verified", inspection.changes);
  }

  return resultFor(options, context, inputDigest, "planned", inspection.changes);
};
