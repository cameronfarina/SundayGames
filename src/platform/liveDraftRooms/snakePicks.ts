import type { SnakeLeagueSeason } from "../leagueSeason.js";
import { isForwardRound } from "../snakeDraftEngine/draftOrder.js";
import type { LiveDraftRoomInitialRosterPlayer } from "./contracts/core.js";
import type { LiveDraftRoomPick, LiveDraftRoomSale } from "./contracts/players.js";

const teamOrderFor = (season: SnakeLeagueSeason): readonly string[] =>
  [...season.teams]
    .sort((left, right) => left.draftOrderPosition - right.draftOrderPosition)
    .map(team => team.id);

/** Every slot in the draft, in the order the room will fill them. */
export const emptyPicksFor = (season: SnakeLeagueSeason): LiveDraftRoomPick[] => {
  const teamOrder = teamOrderFor(season);
  const teamsById = new Map(season.teams.map(team => [team.id, team]));
  const picks: LiveDraftRoomPick[] = [];

  for (let round = 1; round <= season.settings.snake.rounds; round += 1) {
    const roundOrder = isForwardRound(round) ? teamOrder : [...teamOrder].reverse();
    roundOrder.forEach((teamId, index) => {
      const team = teamsById.get(teamId);
      if (team === undefined) return;
      picks.push({
        overall: picks.length + 1,
        round,
        pickInRound: index + 1,
        teamId,
        ownerDisplayName: team.ownerDisplayName,
        teamDisplayName: team.displayName,
      });
    });
  }

  return picks;
};

/**
 * Keepers name a round but not a slot inside it, because a team picks once per
 * round. Sales then take the remaining slots in the order they were recorded.
 */
export const snakePicksFor = (
  season: SnakeLeagueSeason,
  initialRosters: readonly LiveDraftRoomInitialRosterPlayer[],
  sales: readonly LiveDraftRoomSale[],
): readonly LiveDraftRoomPick[] => {
  const picks = emptyPicksFor(season);

  for (const player of initialRosters) {
    const pick = picks.find(candidate =>
      candidate.teamId === player.teamId
      && candidate.round === player.keeperRound
      && candidate.playerName === undefined);
    if (pick === undefined) continue;
    pick.playerName = player.playerName;
    pick.source = player.source ?? "keeper";
  }

  let cursor = 0;
  for (const sale of sales) {
    while (cursor < picks.length && picks[cursor]?.playerName !== undefined) cursor += 1;
    const pick = picks[cursor];
    if (pick === undefined) break;
    pick.playerName = sale.playerName;
    pick.source = "sale";
    pick.saleEventId = sale.saleEventId;
  }

  return picks;
};

export const onTheClockPick = (
  picks: readonly LiveDraftRoomPick[],
): LiveDraftRoomPick | undefined => picks.find(pick => pick.playerName === undefined);
