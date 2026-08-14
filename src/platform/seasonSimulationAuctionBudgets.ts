import type {
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "./genericAuctionMockEngine.js";
import type { SeasonSimulationTargetConstraint } from "./seasonSimulationTargets.js";

export interface SimulationAuctionPositionCap {
  position: string;
  maxAuctionPrice: number;
  excludeNamedTargets: boolean;
}

const additionalSpendLimitFor = (input: {
  team: GenericAuctionMockTeamReadModel;
  player: GenericAuctionMockTeamReadModel["roster"][number];
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>;
  positionCaps: readonly SimulationAuctionPositionCap[];
}): number => {
  if (!input.team.isHuman) return Number.POSITIVE_INFINITY;
  const target = input.targetsByPlayerId.get(input.player.playerId);
  if (target !== undefined) {
    return target.maxAuctionPrice === undefined
      ? 0
      : Math.max(0, target.maxAuctionPrice - input.player.price);
  }
  const positionCap = [...input.positionCaps]
    .reverse()
    .find(cap => cap.position === input.player.position);
  return positionCap === undefined
    ? Number.POSITIVE_INFINITY
    : Math.max(0, positionCap.maxAuctionPrice - input.player.price);
};

const reconcileTeamBudget = (input: {
  team: GenericAuctionMockTeamReadModel;
  targetEndingBudget: number;
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>;
  positionCaps: readonly SimulationAuctionPositionCap[];
}): GenericAuctionMockTeamReadModel => {
  let dollarsToAllocate = Math.max(0, input.team.budgetRemaining - input.targetEndingBudget);
  if (dollarsToAllocate === 0 || input.team.rosterSlotsRemaining > 0) return input.team;

  const addedByPlayerId = new Map<string, number>();
  const candidates = input.team.roster
    .filter(player => player.source !== "keeper")
    .sort((left, right) =>
      right.expectedPrice - left.expectedPrice
      || right.price - left.price
      || left.playerId.localeCompare(right.playerId)
    );
  for (const player of candidates) {
    if (dollarsToAllocate === 0) break;
    const limit = additionalSpendLimitFor({
      team: input.team,
      player,
      targetsByPlayerId: input.targetsByPlayerId,
      positionCaps: input.positionCaps,
    });
    const added = Math.min(dollarsToAllocate, limit);
    if (added <= 0) continue;
    addedByPlayerId.set(player.playerId, added);
    dollarsToAllocate -= added;
  }

  const allocated = input.team.budgetRemaining - input.targetEndingBudget - dollarsToAllocate;
  if (allocated === 0) return input.team;
  return {
    ...input.team,
    spent: input.team.spent + allocated,
    budgetRemaining: input.team.budgetRemaining - allocated,
    roster: input.team.roster.map(player => ({
      ...player,
      price: player.price + (addedByPlayerId.get(player.playerId) ?? 0),
    })),
  };
};

export const reconciledSeasonSimulationTeams = (input: {
  state: GenericAuctionMockState;
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>;
  positionCaps: readonly SimulationAuctionPositionCap[];
}): readonly GenericAuctionMockTeamReadModel[] => {
  const targetEndingBudget = input.state.configuration.ai?.targetEndingBudgetDollars;
  if (targetEndingBudget === undefined) return input.state.teams;
  return input.state.teams.map(team => reconcileTeamBudget({
    team,
    targetEndingBudget,
    targetsByPlayerId: input.targetsByPlayerId,
    positionCaps: input.positionCaps,
  }));
};
