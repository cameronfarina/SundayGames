import type { SyncedMatchup, SyncedRosterPlayer, SyncedTeam } from "./contracts.js";
import {
  numberValue,
  optionalText,
  pointsValue,
  recordArray,
  recordValue,
  stringArray,
  textValue,
} from "./decode.js";
import {
  espnBenchSlotIds,
  espnLineupSlotNames,
  espnPositionNames,
  espnProTeamAbbreviations,
} from "./espnCatalog.js";

const ownerNamesFor = (payload: Record<string, unknown>): ReadonlyMap<string, string> => {
  const names = new Map<string, string>();
  for (const member of recordArray(payload.members)) {
    const id = optionalText(member.id);
    const name = optionalText(member.displayName) ??
      [optionalText(member.firstName), optionalText(member.lastName)]
        .filter(part => part !== undefined).join(" ");
    if (id !== undefined && name.length > 0) names.set(id, name);
  }
  return names;
};

const rosterPlayerFor = (entry: Record<string, unknown>): SyncedRosterPlayer => {
  const player = recordValue(recordValue(entry.playerPoolEntry).player);
  const slotId = textValue(entry.lineupSlotId);
  const starter = !espnBenchSlotIds.has(slotId);
  const position = espnPositionNames[textValue(player.defaultPositionId)];
  const teamAbbreviation = espnProTeamAbbreviations[textValue(player.proTeamId)];
  const injuryStatus = optionalText(entry.injuryStatus) ?? optionalText(player.injuryStatus);

  return {
    providerPlayerId: textValue(entry.playerId),
    name: optionalText(player.fullName) ?? textValue(entry.playerId),
    ...(position === undefined ? {} : { position }),
    ...(teamAbbreviation === undefined ? {} : { teamAbbreviation }),
    ...(starter ? { lineupSlot: espnLineupSlotNames[slotId] ?? slotId } : {}),
    ...(injuryStatus === undefined || injuryStatus === "ACTIVE" || injuryStatus === "NORMAL"
      ? {} : { injuryStatus }),
    starter,
  };
};

export const espnTeamsFor = (payload: Record<string, unknown>): readonly SyncedTeam[] => {
  const ownerNames = ownerNamesFor(payload);

  return recordArray(payload.teams).map(team => {
    const overall = recordValue(recordValue(team.record).overall);
    const players = recordArray(recordValue(team.roster).entries).map(rosterPlayerFor);

    return {
      providerTeamId: textValue(team.id),
      name: optionalText(team.name) ?? `Team ${textValue(team.id)}`,
      ownerNames: stringArray(team.owners)
        .flatMap(ownerId => {
          const name = ownerNames.get(ownerId);
          return name === undefined ? [] : [name];
        }),
      wins: numberValue(overall.wins),
      losses: numberValue(overall.losses),
      ties: numberValue(overall.ties),
      pointsFor: pointsValue(overall.pointsFor),
      pointsAgainst: pointsValue(overall.pointsAgainst),
      players: [
        ...players.filter(player => player.starter),
        ...players.filter(player => !player.starter),
      ],
    };
  });
};

/** A playoff bye shows up as a matchup entry with no away side. */
export const espnMatchupsFor = (payload: Record<string, unknown>): readonly SyncedMatchup[] =>
  recordArray(payload.schedule).flatMap(entry => {
    const home = recordValue(entry.home);
    const homeTeamId = optionalText(home.teamId);
    if (homeTeamId === undefined) return [];
    const away = recordValue(entry.away);
    const awayTeamId = optionalText(away.teamId);
    const week = numberValue(entry.matchupPeriodId);

    return [{
      week,
      matchupKey: `${week}-${textValue(entry.id)}`,
      homeTeamId,
      homePoints: pointsValue(home.totalPoints),
      ...(awayTeamId === undefined
        ? {} : { awayTeamId, awayPoints: pointsValue(away.totalPoints) }),
    }];
  });
