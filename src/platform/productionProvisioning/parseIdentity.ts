import { normalizeEmail } from "../auth.js";
import type { League } from "../leagueSeason.js";
import type { PlatformLeagueMembership } from "../leagueSetup.js";
import { leagueProviders, membershipRoles } from "./constants.js";
import type { ProductionProvisioningAccount } from "./contracts.js";
import { enumAt, fail, objectAt, stringAt } from "./validation.js";

export const accountAt = (value: unknown, index: number): ProductionProvisioningAccount => {
  const path = `accounts[${index}]`;
  const record = objectAt(value, path);
  let email: string;
  try {
    email = normalizeEmail(stringAt(record.email, `${path}.email`));
  } catch {
    return fail(`${path}.email`, "expected an email address.");
  }

  const passwordHashEnv = stringAt(record.passwordHashEnv, `${path}.passwordHashEnv`);
  if (!/^[A-Z][A-Z0-9_]*$/.test(passwordHashEnv)) {
    fail(`${path}.passwordHashEnv`, "expected an uppercase environment variable name.");
  }

  return { id: stringAt(record.id, `${path}.id`), email, passwordHashEnv };
};

export const leagueAt = (value: unknown): League => {
  const record = objectAt(value, "league");
  return {
    id: stringAt(record.id, "league.id"),
    externalLeagueId: stringAt(record.externalLeagueId, "league.externalLeagueId"),
    name: stringAt(record.name, "league.name"),
    provider: enumAt(record.provider, leagueProviders, "league.provider"),
  };
};

export const membershipAt = (
  value: unknown,
  index: number,
  leagueId: string,
): PlatformLeagueMembership => {
  const path = `memberships[${index}]`;
  const record = objectAt(value, path);
  return {
    userId: stringAt(record.accountId, `${path}.accountId`),
    leagueId,
    role: enumAt(record.role, membershipRoles, `${path}.role`),
    ...(record.ownerId === undefined ? {} : { ownerId: stringAt(record.ownerId, `${path}.ownerId`) }),
    ...(record.teamId === undefined ? {} : { teamId: stringAt(record.teamId, `${path}.teamId`) }),
  };
};
