import type {
  ProductionProvisioningContext,
  ResolvedProductionProvisioningDocument,
} from "../productionProvisioning.js";
import { applyAccounts } from "./applyAccounts.js";
import { applyDraftSetup } from "./applyDraftSetup.js";
import { applyKeepers } from "./applyKeepers.js";
import { applyPlayers } from "./applyPlayers.js";
import { applySeason } from "./applySeason.js";
import { assertReadyForAudit, recordAuditReceipt } from "./auditReceipt.js";
import type { ProductionProvisioningDependencies } from "./contracts.js";
import { inspectProvisioning } from "./inspect.js";

export const applyProvisioning = async (
  document: ResolvedProductionProvisioningDocument,
  context: ProductionProvisioningContext,
  dependencies: ProductionProvisioningDependencies,
): Promise<void> => {
  await applyAccounts(document, context, dependencies);
  await applySeason(document, context, dependencies);
  await applyPlayers(document, context, dependencies);
  await applyDraftSetup(document, context, dependencies);
  await applyKeepers(document, context, dependencies);
  assertReadyForAudit(await inspectProvisioning(document, context, dependencies));
  await recordAuditReceipt(document, context, dependencies);
};
