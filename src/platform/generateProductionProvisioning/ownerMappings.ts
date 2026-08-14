import { ownerOrder, type Owner } from "../../../config/league.js";
import { normalizeEmail } from "../auth.js";
import { passwordHashEnvPattern } from "./constants.js";
import type { ProductionOwnerAccountMapping } from "./contracts.js";
import { assertOnlyFields, fail, objectAt, stringAt } from "./validation.js";

export const ownerAt = (value: unknown, path: string): Owner => {
  const owner = stringAt(value, path);
  const configuredOwner = ownerOrder.find(candidate => candidate === owner);
  if (configuredOwner === undefined) return fail(path, `unknown configured owner "${owner}".`);
  return configuredOwner;
};

export const mappingAt = (value: unknown, index: number): ProductionOwnerAccountMapping => {
  const path = `owners[${index}]`;
  const record = objectAt(value, path);
  assertOnlyFields(record, ["owner", "email", "passwordHashEnv"], path);
  let email: string;
  try {
    email = normalizeEmail(stringAt(record.email, `${path}.email`));
  } catch {
    return fail(`${path}.email`, "expected an email address.");
  }
  const passwordHashEnv = stringAt(record.passwordHashEnv, `${path}.passwordHashEnv`);
  if (!passwordHashEnvPattern.test(passwordHashEnv)) {
    fail(`${path}.passwordHashEnv`, "expected an uppercase environment variable name.");
  }
  return { owner: ownerAt(record.owner, `${path}.owner`), email, passwordHashEnv };
};

export const assertUniqueMappingField = (
  mappings: readonly ProductionOwnerAccountMapping[],
  field: keyof ProductionOwnerAccountMapping,
): void => {
  const seen = new Set<string>();
  for (const mapping of mappings) {
    const value = mapping[field];
    if (seen.has(value)) fail(`owners[].${field}`, `duplicate value "${value}".`);
    seen.add(value);
  }
};
