import { initialRosterSources, keeperStatuses, positions } from "./constants.js";
import type {
  ProductionProvisioningCatalogEntry,
  ProductionProvisioningInitialRosterPlayer,
  ProductionProvisioningKeeper,
} from "./contracts.js";
import {
  enumAt,
  fail,
  integerAt,
  nonNegativeNumberAt,
  objectAt,
  optionalIntegerAt,
  stringAt,
} from "./validation.js";

export const catalogEntryAt = (
  value: unknown,
  index: number,
): ProductionProvisioningCatalogEntry => {
  const path = `catalog[${index}]`;
  const record = objectAt(value, path);
  const byeWeek = optionalIntegerAt(record.byeWeek, `${path}.byeWeek`, 1);
  if (byeWeek !== undefined && byeWeek > 18) fail(`${path}.byeWeek`, "expected a week from 1 through 18.");
  return {
    playerId: stringAt(record.playerId, `${path}.playerId`),
    name: stringAt(record.name, `${path}.name`),
    position: enumAt(record.position, positions, `${path}.position`),
    expectedPrice: nonNegativeNumberAt(record.expectedPrice, `${path}.expectedPrice`),
    ...(record.provider === undefined ? {} : { provider: stringAt(record.provider, `${path}.provider`) }),
    ...(record.providerPlayerId === undefined
      ? {}
      : { providerPlayerId: stringAt(record.providerPlayerId, `${path}.providerPlayerId`) }),
    ...(record.teamAbbreviation === undefined
      ? {}
      : { teamAbbreviation: stringAt(record.teamAbbreviation, `${path}.teamAbbreviation`) }),
    ...(byeWeek === undefined ? {} : { byeWeek }),
  };
};

export const initialRosterAt = (
  value: unknown,
  index: number,
  catalogById: ReadonlyMap<string, ProductionProvisioningCatalogEntry>,
): ProductionProvisioningInitialRosterPlayer => {
  const path = `initialRosters[${index}]`;
  const record = objectAt(value, path);
  const playerId = stringAt(record.playerId, `${path}.playerId`);
  const player = catalogById.get(playerId);
  if (player === undefined) return fail(`${path}.playerId`, `references missing catalog player "${playerId}".`);
  return {
    teamId: stringAt(record.teamId, `${path}.teamId`),
    playerId,
    playerName: player.name,
    position: player.position,
    price: integerAt(record.price, `${path}.price`),
    expectedPrice: player.expectedPrice,
    source: enumAt(record.source, initialRosterSources, `${path}.source`),
  };
};

export const keeperAt = (value: unknown, index: number): ProductionProvisioningKeeper => {
  const path = `keepers[${index}]`;
  const record = objectAt(value, path);
  return {
    id: stringAt(record.id, `${path}.id`),
    teamId: stringAt(record.teamId, `${path}.teamId`),
    playerId: stringAt(record.playerId, `${path}.playerId`),
    keeperCost: integerAt(record.keeperCost, `${path}.keeperCost`),
    ...(record.previousCost === undefined
      ? {}
      : { previousCost: integerAt(record.previousCost, `${path}.previousCost`) }),
    status: enumAt(record.status, keeperStatuses, `${path}.status`),
    source: stringAt(record.source, `${path}.source`),
  };
};
