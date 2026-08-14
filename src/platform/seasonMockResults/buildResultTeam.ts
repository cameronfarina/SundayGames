import { bestProjectedLineup } from "./bestProjectedLineup.js";
import { isStarterSlot, rounded } from "./format.js";
import { resultPlayerFor } from "./resultPlayerFor.js";
import type {
  ResultBoardPlayer,
  ResultCandidate,
  ResultTeamInput,
  ScoredResultTeam,
} from "./types.js";

const rosterCandidatesFor = (
  team: ResultTeamInput,
  playersById: ReadonlyMap<string, ResultBoardPlayer>,
): readonly ResultCandidate[] => team.acquisitions.flatMap(acquisition => {
  const player = playersById.get(acquisition.playerId);
  return player === undefined ? [] : [{
    playerId: player.id,
    position: player.position,
    week1Points: player.week1Projection ?? 0,
  }];
});

export const buildResultTeam = (
  team: ResultTeamInput,
  humanTeamId: string,
  playersById: ReadonlyMap<string, ResultBoardPlayer>,
): ScoredResultTeam => {
  const acquisitionsByPlayerId = new Map(
    team.acquisitions.map(acquisition => [acquisition.playerId, acquisition]),
  );
  const rosterCandidates = rosterCandidatesFor(team, playersById);
  const starterSlots = team.slots.flatMap((slot, originalIndex) =>
    isStarterSlot(slot.slot) ? [{ ...slot, originalIndex }] : []
  );
  const lineup = bestProjectedLineup(starterSlots, rosterCandidates);
  const starterPlayerBySlot = new Map(
    lineup.assignments.map(assignment => [assignment.slot, assignment.playerId]),
  );
  const starterPlayerIds = new Set(lineup.assignments.map(assignment => assignment.playerId));
  const starters = starterSlots.flatMap(slot => {
    const playerId = starterPlayerBySlot.get(slot.slot);
    if (playerId === undefined) return [];
    const player = resultPlayerFor(
      playerId, slot.slot, true, playersById, acquisitionsByPlayerId,
    );
    return player === undefined ? [] : [player];
  });
  const benchSlots = team.slots.filter(slot => !isStarterSlot(slot.slot));
  const bench = rosterCandidates
    .filter(player => !starterPlayerIds.has(player.playerId))
    .sort((left, right) =>
      right.week1Points - left.week1Points || left.playerId.localeCompare(right.playerId)
    )
    .flatMap((player, index) => {
      const rosterSlot = benchSlots[index]?.slot ?? `BENCH${index + 1}`;
      const result = resultPlayerFor(
        player.playerId, rosterSlot, false, playersById, acquisitionsByPlayerId,
      );
      return result === undefined ? [] : [result];
    });

  return {
    projectedPlayerCount: rosterCandidates.filter(player =>
      playersById.get(player.playerId)?.week1Projection !== undefined
    ).length,
    rosteredPlayerCount: rosterCandidates.length,
    team: {
      teamId: team.id,
      teamName: team.name,
      rank: 0,
      isUserTeam: team.id === humanTeamId,
      week1Points: rounded(lineup.score),
      ...(team.spent === undefined ? {} : { spent: team.spent }),
      ...(team.budgetRemaining === undefined ? {} : { budgetRemaining: team.budgetRemaining }),
      roster: [...starters, ...bench],
    },
  };
};
