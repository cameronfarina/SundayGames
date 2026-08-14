import type {
  ProductionProvisioningChange,
  ProductionProvisioningChangeAction,
} from "../productionProvisioning.js";

export const provisioningChange = (
  resourceType: string,
  resourceId: string,
  action: ProductionProvisioningChangeAction,
): ProductionProvisioningChange => ({ resourceType, resourceId, action });
