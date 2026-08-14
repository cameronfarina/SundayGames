import type { ProductionProvisioningDocument } from "./contracts.js";
import { fail } from "./validation.js";

export const assertReferences = (document: ProductionProvisioningDocument): void => {
  const accountIds = new Set(document.accounts.map(account => account.id));
  if (!accountIds.has(document.actorAccountId)) {
    fail("actorAccountId", "must reference an account in this document.");
  }

  const teamById = new Map(document.season.teams.map(team => [team.id, team]));
  const catalogIds = new Set(document.catalog.map(player => player.playerId));
  for (const [index, membership] of document.memberships.entries()) {
    if (!accountIds.has(membership.userId)) {
      fail(`memberships[${index}].accountId`, `references missing account "${membership.userId}".`);
    }
    if ((membership.ownerId === undefined) !== (membership.teamId === undefined)) {
      fail(`memberships[${index}]`, "ownerId and teamId must be provided together.");
    }
    if (membership.teamId !== undefined) {
      const team = teamById.get(membership.teamId);
      if (team === undefined || team.ownerId !== membership.ownerId) {
        fail(`memberships[${index}].teamId`, "must reference the matching season team and owner.");
      }
    }
  }

  const actorMembership = document.memberships.find(member => member.userId === document.actorAccountId);
  if (
    actorMembership === undefined
    || (actorMembership.role !== "owner" && actorMembership.role !== "admin")
  ) {
    fail("actorAccountId", "must reference an owner or admin membership.");
  }

  for (const [index, rosterPlayer] of document.initialRosters.entries()) {
    if (!teamById.has(rosterPlayer.teamId)) {
      fail(`initialRosters[${index}].teamId`, `references missing team "${rosterPlayer.teamId}".`);
    }
  }
  for (const [index, keeper] of document.keepers.entries()) {
    if (!teamById.has(keeper.teamId)) {
      fail(`keepers[${index}].teamId`, `references missing team "${keeper.teamId}".`);
    }
    if (!catalogIds.has(keeper.playerId)) {
      fail(`keepers[${index}].playerId`, `references missing catalog player "${keeper.playerId}".`);
    }
    const matchingKeeper = document.initialRosters.find(player =>
      player.teamId === keeper.teamId
      && player.playerId === keeper.playerId
      && player.source === "keeper"
      && player.price === keeper.keeperCost);
    if (keeper.status !== "removed" && matchingKeeper === undefined) {
      fail(`keepers[${index}]`, "must match a keeper entry in initialRosters.");
    }
  }
};
