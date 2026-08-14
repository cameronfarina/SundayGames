import { productionProvisioningSchemaVersion } from "./constants.js";
import type { ProductionProvisioningDocument } from "./contracts.js";
import { assertNoLocalE2eFixtureMarkers } from "./fixturePolicy.js";
import { accountAt, leagueAt, membershipAt } from "./parseIdentity.js";
import { catalogEntryAt, initialRosterAt, keeperAt } from "./parsePlayers.js";
import { seasonAt } from "./parseSeason.js";
import { assertReferences } from "./referenceValidation.js";
import { arrayAt, enumAt, fail, objectAt, stringAt, uniqueBy } from "./validation.js";

const schemaVersions: readonly ProductionProvisioningDocument["schemaVersion"][] = [
  productionProvisioningSchemaVersion,
];
const environments: readonly ProductionProvisioningDocument["environment"][] = ["production"];

export const parseProductionProvisioningDocument = (
  content: string,
): ProductionProvisioningDocument => {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return fail("$", "expected valid JSON.");
  }

  assertNoLocalE2eFixtureMarkers(value);
  const record = objectAt(value, "$");
  const accounts = arrayAt(record.accounts, "accounts").map(accountAt);
  if (accounts.length === 0) fail("accounts", "expected at least one account.");
  uniqueBy(accounts, account => account.id, "accounts[].id");
  uniqueBy(accounts, account => account.email, "accounts[].email");

  const league = leagueAt(record.league);
  const season = seasonAt(record.season, league);
  const memberships = arrayAt(record.memberships, "memberships")
    .map((membership, index) => membershipAt(membership, index, league.id));
  if (memberships.length === 0) fail("memberships", "expected at least one membership.");
  uniqueBy(memberships, membership => membership.userId, "memberships[].accountId");

  const catalog = arrayAt(record.catalog, "catalog").map(catalogEntryAt);
  if (catalog.length === 0) fail("catalog", "expected at least one player.");
  uniqueBy(catalog, player => player.playerId, "catalog[].playerId");
  const catalogById = new Map(catalog.map(player => [player.playerId, player]));
  const initialRosters = arrayAt(record.initialRosters, "initialRosters")
    .map((player, index) => initialRosterAt(player, index, catalogById));
  uniqueBy(initialRosters, player => player.playerId, "initialRosters[].playerId");
  const keepers = arrayAt(record.keepers, "keepers").map(keeperAt);
  uniqueBy(keepers, keeper => keeper.id, "keepers[].id");
  uniqueBy(
    keepers.filter(keeper => keeper.status !== "removed"),
    keeper => keeper.playerId,
    "keepers[].playerId",
  );

  const document: ProductionProvisioningDocument = {
    schemaVersion: enumAt(record.schemaVersion, schemaVersions, "schemaVersion"),
    provisioningId: stringAt(record.provisioningId, "provisioningId"),
    environment: enumAt(record.environment, environments, "environment"),
    actorAccountId: stringAt(record.actorAccountId, "actorAccountId"),
    accounts,
    league,
    memberships,
    season,
    catalog,
    initialRosters,
    keepers,
  };
  assertReferences(document);
  return document;
};
