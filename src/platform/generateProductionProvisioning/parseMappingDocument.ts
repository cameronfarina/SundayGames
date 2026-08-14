import { ownerOrder } from "../../../config/league.js";
import type { ProductionOwnerAccountMappingDocument } from "./contracts.js";
import { canonicalKeeperSelections, keeperSelectionAt } from "./keeperSelections.js";
import { assertUniqueMappingField, mappingAt, ownerAt } from "./ownerMappings.js";
import { assertOnlyFields, fail, objectAt } from "./validation.js";

const mappingDocumentAt = (value: unknown): ProductionOwnerAccountMappingDocument => {
  const record = objectAt(value, "$");
  assertOnlyFields(record, ["commissionerOwner", "owners", "selectedKeepers"], "$");
  if (!Array.isArray(record.owners)) return fail("owners", "expected an array.");
  if (!Array.isArray(record.selectedKeepers)) return fail("selectedKeepers", "expected an array.");
  const mappings = record.owners.map(mappingAt);
  assertUniqueMappingField(mappings, "owner");
  assertUniqueMappingField(mappings, "email");
  assertUniqueMappingField(mappings, "passwordHashEnv");
  const mappingsByOwner = new Map(mappings.map(mapping => [mapping.owner, mapping]));
  for (const owner of ownerOrder) {
    if (!mappingsByOwner.has(owner)) fail("owners", `missing configured owner ${owner}.`);
  }
  const selected = record.selectedKeepers.map(keeperSelectionAt);
  return {
    commissionerOwner: ownerAt(record.commissionerOwner, "commissionerOwner"),
    owners: ownerOrder.map(owner => mappingsByOwner.get(owner)
      ?? fail("owners", `missing configured owner ${owner}.`)),
    selectedKeepers: canonicalKeeperSelections(selected),
  };
};

export const parseProductionOwnerAccountMappingDocument = (
  content: string,
): ProductionOwnerAccountMappingDocument => {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return fail("$", "expected valid JSON.");
  }
  return mappingDocumentAt(value);
};

export const validateProductionOwnerAccountMapping = mappingDocumentAt;
