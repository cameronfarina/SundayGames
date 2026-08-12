import type {
  GenericAuctionMockState,
} from "./genericAuctionMockEngine.js";
import type {
  SnakeDraftState,
} from "./snakeDraftEngine.js";

export interface SeasonMockResultPlayer {
  playerId: string;
  playerName: string;
  position: string;
  rosterSlot: string;
  week1Points: number;
  starter: boolean;
  source: "keeper" | "human" | "ai";
  price?: number | undefined;
  overallPick?: number | undefined;
}

export interface SeasonMockResultTeam {
  teamId: string;
  teamName: string;
  rank: number;
  isUserTeam: boolean;
  week1Points: number;
  spent?: number | undefined;
  budgetRemaining?: number | undefined;
  roster: readonly SeasonMockResultPlayer[];
}

export interface SeasonMockResults {
  teams: readonly SeasonMockResultTeam[];
  projectedPlayerCount: number;
  rosteredPlayerCount: number;
}

interface ResultCandidate {
  playerId: string;
  position: string;
  week1Points: number;
}

interface ResultAcquisition {
  playerId: string;
  source: "keeper" | "human" | "ai";
  price?: number;
  overallPick?: number;
}

interface ResultTeamInput {
  id: string;
  name: string;
  slots: readonly { slot: string; eligiblePositions: readonly string[] }[];
  acquisitions: readonly ResultAcquisition[];
  spent?: number;
  budgetRemaining?: number;
}

interface ResultSlot {
  slot: string;
  eligiblePositions: readonly string[];
  originalIndex: number;
}

interface LineupChoice {
  score: number;
  assignments: readonly { slot: string; playerId: string }[];
}

const rounded = (value: number): number => Math.round(value * 10) / 10;

const isStarterSlot = (slot: string): boolean => !/^(BENCH|IR)\d*$/u.test(slot);

const bestProjectedLineup = (
  slots: readonly ResultSlot[],
  players: readonly ResultCandidate[],
): LineupChoice => {
  const orderedSlots = [...slots].sort((left, right) =>
    left.eligiblePositions.length - right.eligiblePositions.length
    || left.originalIndex - right.originalIndex
  );
  const memo = new Map<string, LineupChoice>();

  const visit = (slotIndex: number, usedPlayerIndexes: ReadonlySet<number>): LineupChoice => {
    if (slotIndex >= orderedSlots.length) return { score: 0, assignments: [] };
    const key = `${slotIndex}:${[...usedPlayerIndexes].sort((left, right) => left - right).join(",")}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const slot = orderedSlots[slotIndex];
    if (slot === undefined) return { score: 0, assignments: [] };
    const eligiblePlayerIndexes = players.flatMap((player, playerIndex) =>
      !usedPlayerIndexes.has(playerIndex) && slot.eligiblePositions.includes(player.position)
        ? [playerIndex]
        : []
    );
    if (eligiblePlayerIndexes.length === 0) {
      const unfilled = visit(slotIndex + 1, usedPlayerIndexes);
      memo.set(key, unfilled);
      return unfilled;
    }

    let best: LineupChoice | undefined;
    for (const playerIndex of eligiblePlayerIndexes) {
      const player = players[playerIndex];
      if (player === undefined) continue;
      const remaining = visit(slotIndex + 1, new Set([...usedPlayerIndexes, playerIndex]));
      const candidate = {
        score: player.week1Points + remaining.score,
        assignments: [
          { slot: slot.slot, playerId: player.playerId },
          ...remaining.assignments,
        ],
      };
      if (best === undefined || candidate.score > best.score) best = candidate;
    }

    const result = best ?? { score: 0, assignments: [] };
    memo.set(key, result);
    return result;
  };

  return visit(0, new Set());
};

const isAuctionState = (
  state: SnakeDraftState | GenericAuctionMockState,
): state is GenericAuctionMockState => "sales" in state;

const resultTeamsFor = (
  state: SnakeDraftState | GenericAuctionMockState,
): readonly ResultTeamInput[] => {
  if (isAuctionState(state)) {
    return state.teams.map(team => ({
      id: team.id,
      name: team.name,
      slots: team.slots,
      acquisitions: team.roster.map(player => ({
        playerId: player.playerId,
        source: player.source,
        price: player.price,
      })),
      spent: team.spent,
      budgetRemaining: team.budgetRemaining,
    }));
  }

  const overallPickByPlayerId = new Map(state.board.picks.flatMap(pick =>
    pick.selection === undefined ? [] : [[pick.selection.playerId, pick.overall] as const]
  ));
  return state.teams.map(team => ({
    id: team.id,
    name: team.name,
    slots: team.slots,
    acquisitions: team.roster.map(player => {
      const overallPick = overallPickByPlayerId.get(player.playerId);
      return {
        playerId: player.playerId,
        source: player.source,
        ...(overallPick === undefined ? {} : { overallPick }),
      };
    }),
  }));
};

export const buildSeasonMockResults = (
  state: SnakeDraftState | GenericAuctionMockState,
): SeasonMockResults => {
  const playersById = new Map(state.board.players.map(player => [player.id, player]));
  const teamsToScore = resultTeamsFor(state);
  let projectedPlayerCount = 0;
  let rosteredPlayerCount = 0;

  const teams = teamsToScore.map(team => {
    const acquisitionByPlayerId = new Map(
      team.acquisitions.map(player => [player.playerId, player]),
    );
    const rosterCandidates = team.acquisitions.flatMap(acquisition => {
      const player = playersById.get(acquisition.playerId);
      if (player === undefined) return [];
      rosteredPlayerCount += 1;
      if (player.week1Projection !== undefined) projectedPlayerCount += 1;
      return [{
        playerId: player.id,
        position: player.position,
        week1Points: player.week1Projection ?? 0,
      }];
    });
    const starterSlots = team.slots.flatMap((slot, originalIndex) =>
      isStarterSlot(slot.slot)
        ? [{ slot: slot.slot, eligiblePositions: slot.eligiblePositions, originalIndex }]
        : []
    );
    const lineup = bestProjectedLineup(starterSlots, rosterCandidates);
    const starterPlayerBySlot = new Map(
      lineup.assignments.map(assignment => [assignment.slot, assignment.playerId]),
    );
    const starterPlayerIds = new Set(lineup.assignments.map(assignment => assignment.playerId));

    const resultPlayer = (
      playerId: string,
      rosterSlot: string,
      starter: boolean,
    ): SeasonMockResultPlayer | undefined => {
      const player = playersById.get(playerId);
      const acquisition = acquisitionByPlayerId.get(playerId);
      if (player === undefined || acquisition === undefined) return undefined;
      return {
        playerId,
        playerName: player.name,
        position: player.position,
        rosterSlot,
        week1Points: rounded(player.week1Projection ?? 0),
        starter,
        source: acquisition.source,
        ...(acquisition.price === undefined ? {} : { price: acquisition.price }),
        ...(acquisition.overallPick === undefined
          ? {}
          : { overallPick: acquisition.overallPick }),
      };
    };

    const starters = starterSlots.flatMap(slot => {
      const playerId = starterPlayerBySlot.get(slot.slot);
      if (playerId === undefined) return [];
      const player = resultPlayer(playerId, slot.slot, true);
      return player === undefined ? [] : [player];
    });
    const benchSlots = team.slots.filter(slot => !isStarterSlot(slot.slot));
    const bench = rosterCandidates
      .filter(player => !starterPlayerIds.has(player.playerId))
      .sort((left, right) => right.week1Points - left.week1Points || left.playerId.localeCompare(right.playerId))
      .flatMap((player, index) => {
        const rosterSlot = benchSlots[index]?.slot ?? `BENCH${index + 1}`;
        const result = resultPlayer(player.playerId, rosterSlot, false);
        return result === undefined ? [] : [result];
      });

    return {
      teamId: team.id,
      teamName: team.name,
      rank: 0,
      isUserTeam: team.id === state.session.humanTeamId,
      week1Points: rounded(lineup.score),
      ...(team.spent === undefined ? {} : { spent: team.spent }),
      ...(team.budgetRemaining === undefined
        ? {}
        : { budgetRemaining: team.budgetRemaining }),
      roster: [...starters, ...bench],
    };
  });

  const rankedTeams = [...teams]
    .sort((left, right) => right.week1Points - left.week1Points || left.teamName.localeCompare(right.teamName))
    .map((team, index) => ({ ...team, rank: index + 1 }));

  return { teams: rankedTeams, projectedPlayerCount, rosteredPlayerCount };
};
