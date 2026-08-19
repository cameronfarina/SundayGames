import type { PlayerDirectory, SyncedRosterPlayer, SyncedTeam } from "./contracts.js";
import { numberValue, optionalText, recordValue, stringArray, textValue } from "./decode.js";

export type SleeperUserRecord = Record<string, unknown>;

/** Sleeper marks an unfilled starting slot with "0" rather than omitting it. */
const emptySlotId = "0";

const benchSlotNames = new Set(["BN", "IR", "TAXI"]);

export const startingSlotsFor = (rosterPositions: readonly string[]): readonly string[] =>
  rosterPositions.filter(position => !benchSlotNames.has(position));

/** Sleeper reports whole points and decimals in separate fields. */
const splitPoints = (settings: Record<string, unknown>, whole: string, decimal: string): number =>
  numberValue(settings[whole]) + numberValue(settings[decimal]) / 100;

const displayNameFor = (user: SleeperUserRecord | undefined): string | undefined => {
  if (user === undefined) return undefined;
  return optionalText(recordValue(user.metadata).team_name) ?? optionalText(user.display_name);
};

const playerFor = (
  providerPlayerId: string,
  directory: PlayerDirectory,
  lineupSlot: string | undefined,
): SyncedRosterPlayer => {
  const entry = directory[providerPlayerId];
  return {
    providerPlayerId,
    name: entry?.name ?? providerPlayerId,
    ...(entry?.position === undefined ? {} : { position: entry.position }),
    ...(entry?.teamAbbreviation === undefined ? {} : { teamAbbreviation: entry.teamAbbreviation }),
    ...(lineupSlot === undefined ? {} : { lineupSlot }),
    starter: lineupSlot !== undefined,
  };
};

export const rosterFor = (
  roster: Record<string, unknown>,
  directory: PlayerDirectory,
  startingSlots: readonly string[],
): readonly SyncedRosterPlayer[] => {
  const starters = stringArray(roster.starters);
  const slotByPlayerId = new Map<string, string>();
  starters.forEach((playerId, index) => {
    if (playerId === emptySlotId) return;
    slotByPlayerId.set(playerId, startingSlots[index] ?? "FLEX");
  });
  const rostered = stringArray(roster.players);
  const bench = rostered.filter(playerId => !slotByPlayerId.has(playerId));

  return [
    ...starters.filter(playerId => playerId !== emptySlotId)
      .map(playerId => playerFor(playerId, directory, slotByPlayerId.get(playerId))),
    ...bench.map(playerId => playerFor(playerId, directory, undefined)),
  ];
};

export const teamsFor = (
  rosters: readonly Record<string, unknown>[],
  users: readonly SleeperUserRecord[],
  directory: PlayerDirectory,
  startingSlots: readonly string[],
): readonly SyncedTeam[] => {
  const userById = new Map<string, SleeperUserRecord>();
  for (const user of users) {
    const userId = optionalText(user.user_id);
    if (userId !== undefined) userById.set(userId, user);
  }

  return rosters.map(roster => {
    const providerTeamId = textValue(roster.roster_id);
    const ownerId = optionalText(roster.owner_id);
    const owner = ownerId === undefined ? undefined : userById.get(ownerId);
    const coOwnerNames = stringArray(roster.co_owners)
      .flatMap(coOwnerId => {
        const name = optionalText(userById.get(coOwnerId)?.display_name);
        return name === undefined ? [] : [name];
      });
    const settings = recordValue(roster.settings);

    return {
      providerTeamId,
      name: displayNameFor(owner) ?? `Team ${providerTeamId}`,
      ownerNames: [
        ...(optionalText(owner?.display_name) === undefined ? [] : [textValue(owner?.display_name)]),
        ...coOwnerNames,
      ],
      wins: numberValue(settings.wins),
      losses: numberValue(settings.losses),
      ties: numberValue(settings.ties),
      pointsFor: splitPoints(settings, "fpts", "fpts_decimal"),
      pointsAgainst: splitPoints(settings, "fpts_against", "fpts_against_decimal"),
      players: rosterFor(roster, directory, startingSlots),
    };
  });
};
