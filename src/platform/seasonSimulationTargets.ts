import { canonicalPlayerIdentityKey } from "../data/normalizePlayerName.js";

export interface SeasonSimulationTargetConstraint {
  playerName: string;
  maxAuctionPrice?: number | undefined;
  maxSnakeRound?: number | undefined;
  maxSnakeOverallPick?: number | undefined;
}

export type SeasonSimulationTargetOutcomeStatus = "hit" | "miss" | "infeasible";

export type SeasonSimulationTargetOutcomeReason =
  | "ambiguous_player_name"
  | "player_not_found"
  | "retained_by_other_team"
  | "retained_by_your_team_above_max_price";

export interface SeasonSimulationTargetInfeasibility {
  reason: SeasonSimulationTargetOutcomeReason;
  message: string;
}

export interface ResolvedSeasonSimulationTarget {
  playerId: string;
  target: SeasonSimulationTargetConstraint;
  infeasibility?: SeasonSimulationTargetInfeasibility | undefined;
}

export interface SeasonSimulationTargetOutcome {
  playerId: string;
  playerName: string;
  status: SeasonSimulationTargetOutcomeStatus;
  feasible: boolean;
  hitCount: number;
  hitRate: number;
  reason?: SeasonSimulationTargetOutcomeReason | undefined;
  message: string;
}

export interface SeasonSimulationTargetRosterPlayer {
  playerId: string;
  price?: number | undefined;
  overallPick?: number | undefined;
  round?: number | undefined;
}

export const targetResolutionInfeasibilityFor = (input: {
  target: SeasonSimulationTargetConstraint;
  ambiguous: boolean;
}): SeasonSimulationTargetInfeasibility => input.ambiguous
  ? {
    reason: "ambiguous_player_name",
    message: `Target player ${input.target.playerName} matches multiple players; use the full name.`,
  }
  : {
    reason: "player_not_found",
    message: `Target player ${input.target.playerName} was not found in the player catalog.`,
  };

export const targetKeeperInfeasibilityFor = (input: {
  playerId: string;
  target: SeasonSimulationTargetConstraint;
  humanTeamId: string;
  draftFormat: "auction" | "snake" | undefined;
  initialRosters: readonly {
    teamId: string;
    playerId?: string | undefined;
    playerName: string;
    price: number;
  }[];
  teams: readonly { id: string; displayName: string }[];
}): SeasonSimulationTargetInfeasibility | undefined => {
  const retainedPlayer = input.initialRosters.find(player =>
    (player.playerId ?? canonicalPlayerIdentityKey(player.playerName)) === input.playerId
  );
  if (retainedPlayer === undefined) return undefined;

  if (retainedPlayer.teamId === input.humanTeamId) {
    if (
      input.draftFormat !== "auction"
      || input.target.maxAuctionPrice === undefined
      || retainedPlayer.price <= input.target.maxAuctionPrice
    ) return undefined;

    return {
      reason: "retained_by_your_team_above_max_price",
      message: `${input.target.playerName} is retained by your team for $${retainedPlayer.price}, above the $${input.target.maxAuctionPrice} target cap. Raise the cap to at least $${retainedPlayer.price} to satisfy this target.`,
    };
  }

  const retainingTeamName = input.teams.find(team => team.id === retainedPlayer.teamId)
    ?.displayName ?? "another team";
  return {
    reason: "retained_by_other_team",
    message: `${input.target.playerName} is retained by ${retainingTeamName} and cannot be acquired. Choose another target.`,
  };
};

export const seasonSimulationTargetOutcomeFor = (input: {
  resolvedTarget: ResolvedSeasonSimulationTarget;
  draftFormat: "auction" | "snake";
  humanRosters: readonly (readonly SeasonSimulationTargetRosterPlayer[])[];
}): SeasonSimulationTargetOutcome => {
  const { playerId, target, infeasibility } = input.resolvedTarget;
  if (infeasibility !== undefined) {
    return {
      playerId,
      playerName: target.playerName,
      status: "infeasible",
      feasible: false,
      hitCount: 0,
      hitRate: 0,
      reason: infeasibility.reason,
      message: infeasibility.message,
    };
  }

  const hitCount = input.humanRosters.filter(roster => roster.some(player => {
    if (player.playerId !== playerId) return false;
    if (input.draftFormat === "auction") {
      return target.maxAuctionPrice === undefined
        || (player.price !== undefined && player.price <= target.maxAuctionPrice);
    }
    return (target.maxSnakeRound === undefined
      || (player.round !== undefined && player.round <= target.maxSnakeRound))
      && (target.maxSnakeOverallPick === undefined
        || (player.overallPick !== undefined
          && player.overallPick <= target.maxSnakeOverallPick));
  })).length;
  const runCount = input.humanRosters.length;
  const status = hitCount === runCount ? "hit" : "miss";
  return {
    playerId,
    playerName: target.playerName,
    status,
    feasible: true,
    hitCount,
    hitRate: hitCount / runCount,
    message: `${target.playerName} was on your team within the target constraints in ${hitCount}/${runCount} runs.`,
  };
};
