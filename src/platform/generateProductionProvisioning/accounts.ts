import { ownerOrder, type Owner } from "../../../config/league.js";
import type {
  ProductionOwnerAccountMappingDocument,
  ProductionProvisioningAccountReference,
} from "./contracts.js";
import { fail } from "./validation.js";
import { provisioningSlug } from "./slug.js";

export const buildAccountsByOwner = (
  document: ProductionOwnerAccountMappingDocument,
): ReadonlyMap<Owner, ProductionProvisioningAccountReference> => {
  const mappings = new Map(document.owners.map(mapping => [mapping.owner, mapping]));
  return new Map(ownerOrder.map(owner => {
    const mapping = mappings.get(owner) ?? fail("owners", `missing configured owner ${owner}.`);
    return [owner, {
      id: `account-${provisioningSlug(owner)}`,
      email: mapping.email,
      passwordHashEnv: mapping.passwordHashEnv,
    }];
  }));
};
