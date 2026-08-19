import type { SnakeLeagueSeason } from "../leagueSeason.js";
import { isForwardRound } from "../snakeDraftEngine/draftOrder.js";
import type { LiveDraftRoomInitialRosterPlayer } from "./contracts/core.js";
import type { LiveDraftRoomPick, LiveDraftRoomPickSelection } from "./contracts/players.js";

const teamOrderFor = (season: SnakeLeagueSeason): readonly string[] =>
  [...season.teams]
    .sort((left, right) => left.draftOrderPosition - right.draftOrderPosition)
    .map(team => team.id);

export const emptyPicksFor = (season: SnakeLeagueSeason): LiveDraftRoomPick[] => {
  const teamOrder = teamOrderFor(season);
  const orderType = season.settings.snake.reversal === "third-round"
    ? "third_round_reversal"
    : "standard";
  const teamsById = new Map(season.teams.map(team => [team.id, team]));
  const picks: LiveDraftRoomPick[] = [];

  for (let round = 1; round <= season.settings.snake.rounds; round += 1) {
    const roundOrder = isForwardRound(round, orderType) ? teamOrder : [...teamOrder].reverse();
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

export const snakePicksFor = (
  season: SnakeLeagueSeason,
  initialRosters: readonly LiveDraftRoomInitialRosterPlayer[],
  selections: readonly LiveDraftRoomPickSelection[],
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

  for (const selection of selections) {
    const pick = picks.find(candidate => candidate.overall === selection.overall);
    if (pick === undefined || pick.playerName !== undefined) continue;
    pick.playerName = selection.playerName;
    pick.source = "pick";
    pick.pickEventId = selection.pickEventId;
  }

  return picks;
};

export const onTheClockPick = (
  picks: readonly LiveDraftRoomPick[],
): LiveDraftRoomPick | undefined => picks.find(pick => pick.playerName === undefined);
