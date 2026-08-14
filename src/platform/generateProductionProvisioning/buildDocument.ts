import { leagueConfig, ownerOrder, type Owner } from "../../../config/league.js";
import { buildCurrentMockdLeagueSeason } from "../leagueSeason.js";
import { productionProvisioningSchemaVersion } from "../productionProvisioning.js";
import { buildAccountsByOwner } from "./accounts.js";
import type { ProvisioningCatalog } from "./catalog.js";
import { currentSeasonYear } from "./constants.js";
import type { ProductionOwnerAccountMappingDocument } from "./contracts.js";
import { buildKeeperRecords } from "./keeperRecords.js";
import { provisioningSlug } from "./slug.js";
import { fail } from "./validation.js";

export const buildProductionProvisioningDocument = (
  mapping: ProductionOwnerAccountMappingDocument,
  catalog: ProvisioningCatalog,
) => {
  const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    seasonYear: currentSeasonYear,
    setupStatus: "published",
  });
  const accounts = buildAccountsByOwner(mapping);
  const teams = new Map(season.teams.map(team => [team.ownerDisplayName, team]));
  const accountFor = (owner: Owner) => accounts.get(owner)
    ?? fail("owners", `missing configured owner ${owner}.`);
  const teamFor = (owner: Owner) => teams.get(owner)
    ?? fail("owners", `missing configured owner ${owner}.`);
  const keeperRecords = buildKeeperRecords(mapping, season.teams, catalog);
  return {
    schemaVersion: productionProvisioningSchemaVersion,
    provisioningId: `mockd-${leagueConfig.leagueId}-${currentSeasonYear}-production`,
    environment: "production",
    actorAccountId: accountFor(mapping.commissionerOwner).id,
    accounts: ownerOrder.map(accountFor),
    league: season.league,
    memberships: ownerOrder.map(owner => ({
      accountId: accountFor(owner).id,
      role: owner === mapping.commissionerOwner ? "owner" : "member",
      ownerId: teamFor(owner).ownerId,
      teamId: teamFor(owner).id,
    })),
    season: {
      id: season.id,
      year: season.seasonYear,
      status: season.setupStatus,
      settings: {
        auction: season.settings.auction,
        roster: {
          rosterSize: season.settings.roster.rosterSize,
          lineup: season.settings.roster.lineup,
          rosterMaximums: season.settings.roster.rosterMaximums,
        },
        keeperPolicy: season.settings.keeperPolicy,
      },
      teams: season.teams.map(team => ({
        id: team.id,
        ownerId: team.ownerId,
        ownerDisplayName: team.ownerDisplayName,
        name: team.displayName,
        draftOrderPosition: team.draftOrderPosition,
      })),
    },
    catalog: catalog.entries,
    initialRosters: keeperRecords.map(({ keeper, team, player }) => ({
      teamId: team.id, playerId: player.playerId, price: keeper.newCost, source: "keeper",
    })),
    keepers: keeperRecords.map(({ keeper, team, player }) => ({
      id: `keeper-${currentSeasonYear}-${provisioningSlug(keeper.owner)}-${player.playerId.replace(/^player-/, "")}`,
      teamId: team.id,
      playerId: player.playerId,
      keeperCost: keeper.newCost,
      previousCost: keeper.priorCost,
      status: "published",
      source: `checked-in-${keeper.status}`,
    })),
  };
};
