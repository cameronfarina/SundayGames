import type {
  GenericAuctionMockBoardPlayer,
  GenericAuctionMockPlannedAcquisition,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "./genericAuctionMockEngine.js";
import type {
  ResolvedSeasonSimulationTarget,
  SeasonSimulationTargetConstraint,
  SeasonSimulationTargetInfeasibility,
} from "./seasonSimulationTargets.js";

const modeledWinningBidFor = (
  player: GenericAuctionMockBoardPlayer,
  target: SeasonSimulationTargetConstraint,
  minimumBid: number,
): number => {
  const marketPrice = Math.max(minimumBid, Math.round(player.expectedPrice));
  return target.maxAuctionPrice === undefined
    ? marketPrice
    : Math.min(target.maxAuctionPrice, marketPrice);
};

const positionsFitOpenSlots = (
  positions: readonly string[],
  team: GenericAuctionMockTeamReadModel,
): boolean => {
  const openSlots = team.slots.filter(slot => slot.playerId === undefined);
  const orderedPositions = [...positions].sort((left, right) =>
    openSlots.filter(slot => slot.eligiblePositions.includes(left)).length
    - openSlots.filter(slot => slot.eligiblePositions.includes(right)).length
  );
  const positionBySlotIndex = new Map<number, number>();
  const assign = (positionIndex: number, visitedSlots: Set<number>): boolean => {
    const position = orderedPositions[positionIndex];
    if (position === undefined) return false;
    for (const [slotIndex, slot] of openSlots.entries()) {
      if (visitedSlots.has(slotIndex) || !slot.eligiblePositions.includes(position)) continue;
      visitedSlots.add(slotIndex);
      const assignedPosition = positionBySlotIndex.get(slotIndex);
      if (assignedPosition === undefined || assign(assignedPosition, visitedSlots)) {
        positionBySlotIndex.set(slotIndex, positionIndex);
        return true;
      }
    }
    return false;
  };
  return orderedPositions.every((_, index) => assign(index, new Set()));
};

const positionsRespectMaximums = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  players: readonly GenericAuctionMockBoardPlayer[],
): boolean => {
  const counts = { ...team.positionCounts };
  for (const player of players) {
    counts[player.position] = (counts[player.position] ?? 0) + 1;
  }
  return Object.entries(counts).every(([position, count]) =>
    count <= (state.configuration.positionMaximums[position] ?? 0)
  );
};

const rosterInfeasibility = (
  target: SeasonSimulationTargetConstraint,
): SeasonSimulationTargetInfeasibility => ({
  reason: "insufficient_roster_slots",
  message: `${target.playerName} cannot fit after higher-priority targets and current keepers. Remove a target or change the roster plan.`,
});

const budgetInfeasibility = (input: {
  target: SeasonSimulationTargetConstraint;
  requiredBudget: number;
  availableBudget: number;
}): SeasonSimulationTargetInfeasibility => ({
  reason: "insufficient_auction_budget",
  message: `${input.target.playerName} would require at least $${input.requiredBudget} across targets and roster reserves, but only $${input.availableBudget} remains. Raise the budget, lower a cap, or remove a higher-priority target.`,
});

export interface AuctionTargetPlan {
  targets: readonly ResolvedSeasonSimulationTarget[];
  plannedAcquisitions: readonly GenericAuctionMockPlannedAcquisition[];
}

export const resolveAuctionTargetPlan = (input: {
  state: GenericAuctionMockState;
  humanTeamId: string;
  targets: readonly ResolvedSeasonSimulationTarget[];
}): AuctionTargetPlan => {
  const team = input.state.teams.find(candidate => candidate.id === input.humanTeamId);
  if (team === undefined) return { targets: input.targets, plannedAcquisitions: [] };

  const retainedPlayerIds = new Set(team.roster.map(player => player.playerId));
  const plannedAcquisitions: GenericAuctionMockPlannedAcquisition[] = [];
  const plannedPlayers: GenericAuctionMockBoardPlayer[] = [];
  let plannedCost = 0;

  const targets = input.targets.map(resolvedTarget => {
    if (resolvedTarget.infeasibility !== undefined) return resolvedTarget;
    if (retainedPlayerIds.has(resolvedTarget.playerId)) return resolvedTarget;
    const player = input.state.board.players.find(candidate =>
      candidate.id === resolvedTarget.playerId
    );
    if (player === undefined) return resolvedTarget;

    const nextPlayers = [...plannedPlayers, player];
    if (
      !positionsFitOpenSlots(nextPlayers.map(candidate => candidate.position), team)
      || !positionsRespectMaximums(input.state, team, nextPlayers)
    ) {
      return { ...resolvedTarget, infeasibility: rosterInfeasibility(resolvedTarget.target) };
    }

    const modeledWinningBid = modeledWinningBidFor(
      player,
      resolvedTarget.target,
      input.state.configuration.minimumBidDollars,
    );
    const nextCost = plannedCost + modeledWinningBid;
    const openNonTargetSlots = team.rosterSlotsRemaining - nextPlayers.length;
    const requiredBudget = nextCost
      + openNonTargetSlots * input.state.configuration.minimumBidDollars;
    if (requiredBudget > team.budgetRemaining) {
      return {
        ...resolvedTarget,
        infeasibility: budgetInfeasibility({
          target: resolvedTarget.target,
          requiredBudget,
          availableBudget: team.budgetRemaining,
        }),
      };
    }

    plannedPlayers.push(player);
    plannedCost = nextCost;
    if (resolvedTarget.target.maxAuctionPrice === undefined) {
      plannedAcquisitions.push({
        teamId: input.humanTeamId,
        playerId: player.id,
        price: modeledWinningBid,
      });
    }
    return resolvedTarget;
  });

  return { targets, plannedAcquisitions };
};
