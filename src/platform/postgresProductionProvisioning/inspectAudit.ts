import type { ProductionProvisioningContext } from "../productionProvisioning.js";
import { provisioningChange } from "./change.js";
import type { ProductionProvisioningDependencies } from "./contracts.js";

export const inspectAudit = async (
  context: ProductionProvisioningContext,
  dependencies: ProductionProvisioningDependencies,
): Promise<{ change: ReturnType<typeof provisioningChange>; auditRecorded: boolean }> => {
  const result = await dependencies.client.query<{ id: string }>(
    "SELECT id FROM audit_events WHERE id = $1",
    [context.auditEventId],
  );
  const auditRecorded = result.rows[0] !== undefined;
  return {
    change: provisioningChange(
      "audit-event",
      context.auditEventId,
      auditRecorded ? "unchanged" : "create",
    ),
    auditRecorded,
  };
};
