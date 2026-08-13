import type { Position } from "../../config/league.js";

export type PostDraftFormat = "auction" | "snake";
export type TeamAnalysisComponent = "starterProjection" | "benchDepth" | "positionalBalance";
export type RosterStrengthCode = "balanced_positions" | "deep_bench" | "strong_starters";
export type RosterRiskCode =
  | "positional_imbalance"
  | "starter_slots_unfilled"
  | "thin_bench"
  | "weak_starters";

export interface MyTeamOwnershipContext {
  userId: string;
  privateOwnerUserId: string;
  leagueId: string;
  seasonId: string;
  teamId: string;
  ownerId: string;
}

export interface PostDraftRosterPlayer {
  playerId: string;
  playerName: string;
  position: Position;
}

export interface PostDraftTeamRoster {
  teamId: string;
  ownerId: string;
  players: readonly PostDraftRosterPlayer[];
}

export interface CompletedDraftRosterSnapshot {
  snapshotId: string;
  leagueId: string;
  seasonId: string;
  capturedAt: string;
  status: "complete";
  draftFormat: PostDraftFormat;
  teams: readonly PostDraftTeamRoster[];
}

export interface PostDraftScoringSettings {
  id: string;
  rules: Readonly<Record<string, number>>;
}

export interface PostDraftStarterSlot {
  slot: string;
  eligiblePositions: readonly Position[];
}

export interface PostDraftRosterSettings {
  rosterSize: number;
  starterSlots: readonly PostDraftStarterSlot[];
}

export interface PostDraftLeagueSettings {
  leagueId: string;
  seasonId: string;
  scoring: PostDraftScoringSettings;
  roster: PostDraftRosterSettings;
}

export interface PostDraftProjectionSnapshotMetadata {
  snapshotId: string;
  leagueId: string;
  seasonId: string;
  scoringSettingsId?: string;
  generatedAt: string;
  validThrough: string;
  week?: number;
  source?: PostDraftProjectionSource;
}

export interface PostDraftProjectionSource {
  kind: "weekly_scoring_specific" | "static_fallback";
  provider: string;
  datasetId: string;
  capturedAt: string;
  confidence: "high" | "low";
  weekly: boolean;
  scoringSpecific: boolean;
}

export interface PostDraftProjection {
  playerId: string;
  playerName: string;
  position: Position;
  seasonProjectedPoints: number;
  weeklyProjectedPoints?: number;
}

export interface PostDraftProjectionSnapshot {
  metadata: PostDraftProjectionSnapshotMetadata;
  projections: readonly PostDraftProjection[];
}

export interface CurrentRosterSnapshotMetadata {
  snapshotId: string;
  leagueId: string;
  seasonId: string;
  teamId: string;
  privateOwnerUserId: string;
  capturedAt: string;
  validThrough: string;
  players?: readonly PostDraftRosterPlayer[];
}

export interface FreeAgentSnapshotMetadata {
  snapshotId: string;
  leagueId: string;
  seasonId: string;
  capturedAt: string;
  validThrough: string;
  players?: readonly PostDraftRosterPlayer[];
}

export interface AnalyzePostDraftTeamInput {
  ownership: MyTeamOwnershipContext;
  evaluatedAt: Date;
  currentWeek: number;
  leagueSettings: PostDraftLeagueSettings;
  completedDraftRoster: CompletedDraftRosterSnapshot;
  projectionSnapshot: PostDraftProjectionSnapshot;
  currentRosterSnapshot?: CurrentRosterSnapshotMetadata;
  freeAgentSnapshot?: FreeAgentSnapshotMetadata;
}

export type PostDraftTeamAnalysisErrorCode =
  | "owned_team_mismatch"
  | "owned_team_missing"
  | "private_owner_mismatch"
  | "snapshot_context_mismatch";

export class PostDraftTeamAnalysisError extends Error {
  constructor(
    readonly code: PostDraftTeamAnalysisErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PostDraftTeamAnalysisError";
  }
}

export interface ProjectedRosterPlayerContribution {
  playerId: string;
  playerName: string;
  position: Position;
  projectedPoints: number;
}

export interface ProjectedStarterContribution extends ProjectedRosterPlayerContribution {
  slot: string;
}

export interface StarterProjectionComponent {
  projectedPoints: number;
  filledSlots: number;
  requiredSlots: number;
  lineup: readonly ProjectedStarterContribution[];
  leagueRank: number;
  normalizedScore: number;
  weight: 0.6;
}

export interface BenchDepthComponent {
  projectedPoints: number;
  countedPlayers: number;
  availableBenchSlots: number;
  players: readonly ProjectedRosterPlayerContribution[];
  leagueRank: number;
  normalizedScore: number;
  weight: 0.25;
}

export interface PositionBalanceDetail {
  position: Position;
  actualPlayers: number;
  expectedPlayers: number;
}

export interface PositionalBalanceComponent {
  score: number;
  positions: readonly PositionBalanceDetail[];
  leagueRank: number;
  normalizedScore: number;
  weight: 0.15;
}

export interface AvailablePostDraftTeamRanking {
  status: "available";
  rank: number;
  teamCount: number;
  overallScore: number;
  components: {
    starterProjection: StarterProjectionComponent;
    benchDepth: BenchDepthComponent;
    positionalBalance: PositionalBalanceComponent;
  };
  explanation: {
    formula: "starter projection 60% + bench depth 25% + positional balance 15%";
    projectionSnapshotId: string;
    scoringSettingsId: string;
  };
}

export type TeamRankingUnavailableReasonCode =
  | "projection_coverage_incomplete"
  | "projection_scoring_settings_mismatch"
  | "projection_scoring_settings_unverified"
  | "roster_materially_incomplete";

export interface TeamRankingUnavailableReason {
  code: TeamRankingUnavailableReasonCode;
  message: string;
  projectionSnapshotId: string;
  playerIds?: readonly string[];
}

export interface UnavailablePostDraftTeamRanking {
  status: "unavailable";
  teamCount: number;
  reasons: readonly TeamRankingUnavailableReason[];
}

export type PostDraftTeamRanking = AvailablePostDraftTeamRanking | UnavailablePostDraftTeamRanking;

export interface RosterAnalysisFinding {
  code: RosterStrengthCode | RosterRiskCode;
  component: TeamAnalysisComponent;
  summary: string;
  evidence: string;
}

export type RecommendationReadinessStatus = "ready" | "stale" | "unavailable";
export type RecommendationInput = "currentRoster" | "freeAgents" | "weeklyProjections";
export type RecommendationReadinessReasonCode =
  | "current_roster_snapshot_missing"
  | "current_roster_snapshot_stale"
  | "current_roster_players_missing"
  | "current_roster_projection_coverage_incomplete"
  | "free_agent_snapshot_missing"
  | "free_agent_snapshot_stale"
  | "free_agent_players_missing"
  | "free_agent_projection_coverage_incomplete"
  | "projection_scoring_settings_mismatch"
  | "projection_scoring_settings_unverified"
  | "weekly_projection_coverage_incomplete"
  | "weekly_projection_source_unverified"
  | "weekly_projections_stale"
  | "weekly_projections_wrong_week";

export interface RecommendationReadinessReason {
  code: RecommendationReadinessReasonCode;
  input: RecommendationInput;
  message: string;
  snapshotId?: string;
  playerIds?: readonly string[];
}

export interface CoachRecommendationReadiness {
  status: RecommendationReadinessStatus;
  reasons: readonly RecommendationReadinessReason[];
  snapshotIds: readonly string[];
}

export interface CoachProjectedPlayer {
  playerId: string;
  playerName: string;
  position: Position;
  projectedPoints: number;
}

export interface StartSitRecommendationRecord {
  recommendationId: string;
  slot: string;
  start: CoachProjectedPlayer;
  sit?: CoachProjectedPlayer;
  projectedPointEdge?: number;
  explanation: string;
}

export interface PickupDropRecommendationRecord {
  recommendationId: string;
  add: CoachProjectedPlayer;
  drop: CoachProjectedPlayer;
  projectedPointGain: number;
  explanation: string;
}

export interface CoachRecommendationSet<Recommendation> extends CoachRecommendationReadiness {
  records: readonly Recommendation[];
}

export interface PostDraftProjectionProvenance {
  snapshotId: string;
  scoringSettingsId?: string;
  generatedAt: string;
  validThrough: string;
  week?: number;
  source?: PostDraftProjectionSource;
}

export interface PostDraftTeamAnalysis {
  ownership: MyTeamOwnershipContext;
  generatedAt: Date;
  projectionProvenance: PostDraftProjectionProvenance;
  ranking: PostDraftTeamRanking;
  strengths: readonly RosterAnalysisFinding[];
  risks: readonly RosterAnalysisFinding[];
  recommendationReadiness: {
    startSit: CoachRecommendationReadiness;
    pickupDrop: CoachRecommendationReadiness;
  };
  recommendations: {
    startSit: CoachRecommendationSet<StartSitRecommendationRecord>;
    pickupDrop: CoachRecommendationSet<PickupDropRecommendationRecord>;
  };
}

interface StarterSelection {
  projectedPoints: number;
  selectedPlayerIndexes: ReadonlySet<number>;
  filledSlots: number;
  lineup: readonly ProjectedStarterContribution[];
}

interface TeamComponentValues {
  teamId: string;
  starterProjectedPoints: number;
  filledSlots: number;
  starterLineup: readonly ProjectedStarterContribution[];
  benchProjectedPoints: number;
  countedBenchPlayers: number;
  benchPlayers: readonly ProjectedRosterPlayerContribution[];
  positionalBalanceScore: number;
  positionDetails: readonly PositionBalanceDetail[];
}

interface RankedTeam extends TeamComponentValues {
  starterRank: number;
  starterNormalizedScore: number;
  benchRank: number;
  benchNormalizedScore: number;
  balanceRank: number;
  balanceNormalizedScore: number;
  overallScore: number;
  overallRank: number;
}

const starterWeight = 0.6 as const;
const benchWeight = 0.25 as const;
const balanceWeight = 0.15 as const;
const rankingFormula = "starter projection 60% + bench depth 25% + positional balance 15%" as const;
const staleRecommendationReasonCodes = new Set<RecommendationReadinessReasonCode>([
  "current_roster_snapshot_stale",
  "free_agent_snapshot_stale",
  "weekly_projections_stale",
]);

const round = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const readinessStatusFor = (
  reasons: readonly RecommendationReadinessReason[],
): RecommendationReadinessStatus => {
  if (reasons.length === 0) return "ready";
  if (reasons.every(reason => staleRecommendationReasonCodes.has(reason.code))) return "stale";

  return "unavailable";
};

const bitCount = (value: number): number => {
  let remaining = value;
  let count = 0;

  while (remaining !== 0) {
    count += remaining & 1;
    remaining >>>= 1;
  }

  return count;
};

const selectStarters = (
  roster: PostDraftTeamRoster,
  projectionsByPlayerId: ReadonlyMap<string, PostDraftProjection>,
  slots: readonly PostDraftStarterSlot[],
): StarterSelection => {
  interface State {
    projectedPoints: number;
    assignments: readonly { playerIndex: number; slotIndex: number }[];
  }

  let states = new Map<number, State>([[0, { projectedPoints: 0, assignments: [] }]]);

  roster.players.forEach((player, playerIndex) => {
    const projection = projectionsByPlayerId.get(player.playerId);
    if (projection === undefined) return;

    const nextStates = new Map(states);
    for (const [mask, state] of states) {
      slots.forEach((slot, slotIndex) => {
        const slotBit = 1 << slotIndex;
        if ((mask & slotBit) !== 0 || !slot.eligiblePositions.includes(player.position)) return;

        const nextMask = mask | slotBit;
        const candidate: State = {
          projectedPoints: state.projectedPoints + projection.seasonProjectedPoints,
          assignments: [...state.assignments, { playerIndex, slotIndex }],
        };
        const current = nextStates.get(nextMask);

        if (current === undefined || candidate.projectedPoints > current.projectedPoints) {
          nextStates.set(nextMask, candidate);
        }
      });
    }
    states = nextStates;
  });

  const [mask, best] = [...states.entries()].sort(([leftMask, left], [rightMask, right]) =>
    bitCount(rightMask) - bitCount(leftMask) ||
    right.projectedPoints - left.projectedPoints
  )[0] ?? [0, { projectedPoints: 0, assignments: [] }];
  const assignments = [...best.assignments].sort((left, right) => left.slotIndex - right.slotIndex);

  return {
    projectedPoints: round(best.projectedPoints),
    selectedPlayerIndexes: new Set(assignments.map(assignment => assignment.playerIndex)),
    filledSlots: bitCount(mask),
    lineup: assignments.map(assignment => {
      const player = roster.players[assignment.playerIndex];
      const slot = slots[assignment.slotIndex];
      const projection = player === undefined ? undefined : projectionsByPlayerId.get(player.playerId);

      if (player === undefined || slot === undefined || projection === undefined) {
        throw new Error("Starter assignment references unavailable roster inputs.");
      }

      return {
        slot: slot.slot,
        playerId: player.playerId,
        playerName: player.playerName,
        position: player.position,
        projectedPoints: round(projection.seasonProjectedPoints),
      };
    }),
  };
};

const positionalBalanceFor = (
  roster: PostDraftTeamRoster,
  settings: PostDraftRosterSettings,
): Pick<TeamComponentValues, "positionalBalanceScore" | "positionDetails"> => {
  const demandByPosition = new Map<Position, number>();

  for (const slot of settings.starterSlots) {
    const share = 1 / slot.eligiblePositions.length;
    for (const position of slot.eligiblePositions) {
      demandByPosition.set(position, (demandByPosition.get(position) ?? 0) + share);
    }
  }

  const starterSlotCount = settings.starterSlots.length;
  const positionDetails = [...demandByPosition.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([position, demand]): PositionBalanceDetail => ({
      position,
      actualPlayers: roster.players.filter(player => player.position === position).length,
      expectedPlayers: round(starterSlotCount === 0 ? 0 : (demand / starterSlotCount) * settings.rosterSize),
    }));
  const totalDeviation = positionDetails.reduce(
    (total, detail) => total + Math.abs(detail.actualPlayers - detail.expectedPlayers),
    0,
  );
  const score = settings.rosterSize === 0
    ? 0
    : Math.max(0, 100 * (1 - totalDeviation / (2 * settings.rosterSize)));

  return {
    positionalBalanceScore: round(score),
    positionDetails,
  };
};

const componentValuesFor = (
  roster: PostDraftTeamRoster,
  settings: PostDraftRosterSettings,
  projectionsByPlayerId: ReadonlyMap<string, PostDraftProjection>,
): TeamComponentValues => {
  const starters = selectStarters(roster, projectionsByPlayerId, settings.starterSlots);
  const availableBenchSlots = Math.max(0, settings.rosterSize - settings.starterSlots.length);
  const benchPlayers = roster.players
    .flatMap((player, playerIndex) => {
      if (starters.selectedPlayerIndexes.has(playerIndex)) return [];
      const projection = projectionsByPlayerId.get(player.playerId);
      return projection === undefined ? [] : [{ player, projectedPoints: projection.seasonProjectedPoints }];
    })
    .sort((left, right) =>
      right.projectedPoints - left.projectedPoints || left.player.playerId.localeCompare(right.player.playerId)
    )
    .slice(0, availableBenchSlots)
    .map(({ player, projectedPoints }): ProjectedRosterPlayerContribution => ({
      playerId: player.playerId,
      playerName: player.playerName,
      position: player.position,
      projectedPoints: round(projectedPoints),
    }));

  return {
    teamId: roster.teamId,
    starterProjectedPoints: starters.projectedPoints,
    filledSlots: starters.filledSlots,
    starterLineup: starters.lineup,
    benchProjectedPoints: round(benchPlayers.reduce((total, player) => total + player.projectedPoints, 0)),
    countedBenchPlayers: benchPlayers.length,
    benchPlayers,
    ...positionalBalanceFor(roster, settings),
  };
};

const ranksFor = <Team extends { teamId: string }>(
  teams: readonly Team[],
  valueFor: (team: Team) => number,
): ReadonlyMap<string, number> => {
  const sortedTeams = [...teams]
    .sort((left, right) => valueFor(right) - valueFor(left) || left.teamId.localeCompare(right.teamId));
  const ranks = new Map<string, number>();
  let previousValue: number | undefined;
  let previousRank = 0;

  sortedTeams.forEach((team, index) => {
    const value = valueFor(team);
    const rank = previousValue === value ? previousRank : index + 1;
    ranks.set(team.teamId, rank);
    previousValue = value;
    previousRank = rank;
  });

  return ranks;
};

const normalizedScoresFor = (
  teams: readonly TeamComponentValues[],
  valueFor: (team: TeamComponentValues) => number,
): ReadonlyMap<string, number> => {
  const values = teams.map(valueFor);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);

  return new Map(teams.map(team => [
    team.teamId,
    maximum === minimum ? 100 : round(((valueFor(team) - minimum) / (maximum - minimum)) * 100),
  ]));
};

const rankTeams = (teams: readonly TeamComponentValues[]): RankedTeam[] => {
  const starterRanks = ranksFor(teams, team => team.starterProjectedPoints);
  const benchRanks = ranksFor(teams, team => team.benchProjectedPoints);
  const balanceRanks = ranksFor(teams, team => team.positionalBalanceScore);
  const starterScores = normalizedScoresFor(teams, team => team.starterProjectedPoints);
  const benchScores = normalizedScoresFor(teams, team => team.benchProjectedPoints);
  const balanceScores = normalizedScoresFor(teams, team => team.positionalBalanceScore);
  const withScores = teams.map(team => {
    const starterNormalizedScore = starterScores.get(team.teamId) ?? 0;
    const benchNormalizedScore = benchScores.get(team.teamId) ?? 0;
    const balanceNormalizedScore = balanceScores.get(team.teamId) ?? 0;

    return {
      ...team,
      starterRank: starterRanks.get(team.teamId) ?? teams.length,
      starterNormalizedScore,
      benchRank: benchRanks.get(team.teamId) ?? teams.length,
      benchNormalizedScore,
      balanceRank: balanceRanks.get(team.teamId) ?? teams.length,
      balanceNormalizedScore,
      overallScore: round(
        starterNormalizedScore * starterWeight +
        benchNormalizedScore * benchWeight +
        balanceNormalizedScore * balanceWeight,
      ),
    };
  });
  const overallRanks = ranksFor(withScores, team => team.overallScore);

  return withScores.map(team => ({
    ...team,
    overallRank: overallRanks.get(team.teamId) ?? teams.length,
  }));
};

const findingsFor = (
  team: RankedTeam,
  teamCount: number,
  requiredStarterSlots: number,
): { strengths: RosterAnalysisFinding[]; risks: RosterAnalysisFinding[] } => {
  const strengths: RosterAnalysisFinding[] = [];
  const risks: RosterAnalysisFinding[] = [];
  const tierSize = Math.max(1, Math.ceil(teamCount / 3));
  const bottomTierStartsAt = teamCount - tierSize + 1;

  if (team.starterRank <= tierSize) {
    strengths.push({
      code: "strong_starters",
      component: "starterProjection",
      summary: "Projected starters are a league strength.",
      evidence: `Starter projection ranks ${team.starterRank} of ${teamCount}.`,
    });
  } else if (team.starterRank >= bottomTierStartsAt) {
    risks.push({
      code: "weak_starters",
      component: "starterProjection",
      summary: "Projected starter output trails the league.",
      evidence: `Starter projection ranks ${team.starterRank} of ${teamCount}.`,
    });
  }

  if (team.benchRank <= tierSize) {
    strengths.push({
      code: "deep_bench",
      component: "benchDepth",
      summary: "The bench projects as a league strength.",
      evidence: `Bench depth ranks ${team.benchRank} of ${teamCount}.`,
    });
  } else if (team.benchRank >= bottomTierStartsAt) {
    risks.push({
      code: "thin_bench",
      component: "benchDepth",
      summary: "The bench projects behind most of the league.",
      evidence: `Bench depth ranks ${team.benchRank} of ${teamCount}.`,
    });
  }

  if (team.balanceRank <= tierSize) {
    strengths.push({
      code: "balanced_positions",
      component: "positionalBalance",
      summary: "Roster allocation is balanced across eligible positions.",
      evidence: `Positional balance ranks ${team.balanceRank} of ${teamCount}.`,
    });
  } else if (team.balanceRank >= bottomTierStartsAt) {
    risks.push({
      code: "positional_imbalance",
      component: "positionalBalance",
      summary: "Roster allocation is uneven across eligible positions.",
      evidence: `Positional balance ranks ${team.balanceRank} of ${teamCount}.`,
    });
  }

  if (team.filledSlots < requiredStarterSlots) {
    risks.push({
      code: "starter_slots_unfilled",
      component: "starterProjection",
      summary: "The roster cannot fill every configured starter slot.",
      evidence: `${team.filledSlots} of ${requiredStarterSlots} starter slots were filled.`,
    });
  }

  return { strengths, risks };
};

const initialRecommendationReadiness = (
  input: AnalyzePostDraftTeamInput,
): PostDraftTeamAnalysis["recommendationReadiness"] => {
  const projectionMetadata = input.projectionSnapshot.metadata;
  const projectionSnapshotId = projectionMetadata.snapshotId;
  const projectionsByPlayerId = new Map(
    input.projectionSnapshot.projections.map(projection => [projection.playerId, projection]),
  );
  const playersWithoutWeeklyProjections = (input.currentRosterSnapshot?.players ?? [])
    .filter(player => !Number.isFinite(projectionsByPlayerId.get(player.playerId)?.weeklyProjectedPoints))
    .map(player => player.playerId);
  const weeklyReasons: RecommendationReadinessReason[] = [];

  if (
    projectionMetadata.source !== undefined &&
    (
      projectionMetadata.source.kind !== "weekly_scoring_specific" ||
      !projectionMetadata.source.weekly ||
      !projectionMetadata.source.scoringSpecific ||
      projectionMetadata.source.confidence !== "high"
    )
  ) {
    weeklyReasons.push({
      code: "weekly_projection_source_unverified",
      input: "weeklyProjections",
      message: `Static ${projectionMetadata.source.provider} fallback data is not a current, league-scoring-specific weekly projection source.`,
      snapshotId: projectionSnapshotId,
    });
  }
  if (projectionMetadata.scoringSettingsId === undefined) {
    weeklyReasons.push({
      code: "projection_scoring_settings_unverified",
      input: "weeklyProjections",
      message: `Projection snapshot ${projectionSnapshotId} was not calculated for this league's scoring settings.`,
      snapshotId: projectionSnapshotId,
    });
  } else if (projectionMetadata.scoringSettingsId !== input.leagueSettings.scoring.id) {
    weeklyReasons.push({
      code: "projection_scoring_settings_mismatch",
      input: "weeklyProjections",
      message: `Projection snapshot ${projectionSnapshotId} uses ${projectionMetadata.scoringSettingsId}, not ${input.leagueSettings.scoring.id}.`,
      snapshotId: projectionSnapshotId,
    });
  }
  if (projectionMetadata.week !== input.currentWeek) {
    weeklyReasons.push({
      code: "weekly_projections_wrong_week",
      input: "weeklyProjections",
      message: `Weekly projections are for week ${projectionMetadata.week ?? "unknown"}, not week ${input.currentWeek}.`,
      snapshotId: projectionSnapshotId,
    });
  }
  if (playersWithoutWeeklyProjections.length > 0) {
    weeklyReasons.push({
      code: "weekly_projection_coverage_incomplete",
      input: "weeklyProjections",
      message: "Weekly projections do not cover every player on the owned roster.",
      snapshotId: projectionSnapshotId,
      playerIds: playersWithoutWeeklyProjections,
    });
  }
  if (new Date(projectionMetadata.validThrough) < input.evaluatedAt) {
    weeklyReasons.push({
      code: "weekly_projections_stale",
      input: "weeklyProjections",
      message: `Weekly projections expired at ${projectionMetadata.validThrough}.`,
      snapshotId: projectionSnapshotId,
    });
  }
  if (input.currentRosterSnapshot === undefined) {
    weeklyReasons.push({
      code: "current_roster_snapshot_missing",
      input: "currentRoster",
      message: "A current roster snapshot is required for start/sit and pickup/drop advice.",
    });
  } else if (new Date(input.currentRosterSnapshot.validThrough) < input.evaluatedAt) {
    weeklyReasons.push({
      code: "current_roster_snapshot_stale",
      input: "currentRoster",
      message: `Current roster state expired at ${input.currentRosterSnapshot.validThrough}.`,
      snapshotId: input.currentRosterSnapshot.snapshotId,
    });
  } else if (input.currentRosterSnapshot.players === undefined) {
    weeklyReasons.push({
      code: "current_roster_players_missing",
      input: "currentRoster",
      message: "Current roster state does not include the players required for coach advice.",
      snapshotId: input.currentRosterSnapshot.snapshotId,
    });
  }

  const startSit: CoachRecommendationReadiness = {
    status: readinessStatusFor(weeklyReasons),
    reasons: weeklyReasons,
    snapshotIds: [
      projectionSnapshotId,
      ...(input.currentRosterSnapshot === undefined ? [] : [input.currentRosterSnapshot.snapshotId]),
    ],
  };
  const pickupDropReasons: RecommendationReadinessReason[] = [...weeklyReasons];

  if (
    input.currentRosterSnapshot !== undefined &&
    new Date(input.currentRosterSnapshot.validThrough) >= input.evaluatedAt &&
    input.currentRosterSnapshot.players !== undefined
  ) {
    const missingPlayerIds = input.currentRosterSnapshot.players
      .filter(player => !Number.isFinite(projectionsByPlayerId.get(player.playerId)?.weeklyProjectedPoints))
      .map(player => player.playerId);
    if (missingPlayerIds.length > 0) {
      pickupDropReasons.push({
        code: "current_roster_projection_coverage_incomplete",
        input: "weeklyProjections",
        message: "Weekly projections do not cover every player on the current roster.",
        snapshotId: projectionSnapshotId,
        playerIds: missingPlayerIds,
      });
    }
  }
  if (input.freeAgentSnapshot === undefined) {
    pickupDropReasons.push({
      code: "free_agent_snapshot_missing",
      input: "freeAgents",
      message: "A current free-agent snapshot is required for pickup/drop advice.",
    });
  } else if (new Date(input.freeAgentSnapshot.validThrough) < input.evaluatedAt) {
    pickupDropReasons.push({
      code: "free_agent_snapshot_stale",
      input: "freeAgents",
      message: `Free-agent state expired at ${input.freeAgentSnapshot.validThrough}.`,
      snapshotId: input.freeAgentSnapshot.snapshotId,
    });
  } else if (input.freeAgentSnapshot.players === undefined) {
    pickupDropReasons.push({
      code: "free_agent_players_missing",
      input: "freeAgents",
      message: "Free-agent state does not include the players required for pickup/drop advice.",
      snapshotId: input.freeAgentSnapshot.snapshotId,
    });
  } else {
    const missingPlayerIds = input.freeAgentSnapshot.players
      .filter(player => !Number.isFinite(projectionsByPlayerId.get(player.playerId)?.weeklyProjectedPoints))
      .map(player => player.playerId);
    if (missingPlayerIds.length > 0) {
      pickupDropReasons.push({
        code: "free_agent_projection_coverage_incomplete",
        input: "weeklyProjections",
        message: "Weekly projections do not cover every available free agent.",
        snapshotId: projectionSnapshotId,
        playerIds: missingPlayerIds,
      });
    }
  }

  return {
    startSit,
    pickupDrop: {
      status: readinessStatusFor(pickupDropReasons),
      reasons: pickupDropReasons,
      snapshotIds: [
        projectionSnapshotId,
        ...(input.currentRosterSnapshot === undefined ? [] : [input.currentRosterSnapshot.snapshotId]),
        ...(input.freeAgentSnapshot === undefined ? [] : [input.freeAgentSnapshot.snapshotId]),
      ],
    },
  };
};

const projectedPlayer = (
  player: PostDraftRosterPlayer,
  projectionsByPlayerId: ReadonlyMap<string, PostDraftProjection>,
): CoachProjectedPlayer | undefined => {
  const projectedPoints = projectionsByPlayerId.get(player.playerId)?.weeklyProjectedPoints;
  if (typeof projectedPoints !== "number" || !Number.isFinite(projectedPoints)) return undefined;

  return {
    playerId: player.playerId,
    playerName: player.playerName,
    position: player.position,
    projectedPoints: round(projectedPoints),
  };
};

const startSitRecommendationRecords = (
  input: AnalyzePostDraftTeamInput,
): StartSitRecommendationRecord[] => {
  const currentRosterPlayers = input.currentRosterSnapshot?.players;
  if (currentRosterPlayers === undefined) return [];
  const currentRoster: PostDraftTeamRoster = {
    teamId: input.ownership.teamId,
    ownerId: input.ownership.ownerId,
    players: currentRosterPlayers,
  };

  const projectionsByPlayerId = new Map(
    input.projectionSnapshot.projections.map(projection => [projection.playerId, projection]),
  );
  const weeklyProjectionsByPlayerId = new Map(
    input.projectionSnapshot.projections.flatMap(projection => {
      if (
        typeof projection.weeklyProjectedPoints !== "number" ||
        !Number.isFinite(projection.weeklyProjectedPoints)
      ) return [];

      return [[projection.playerId, {
        ...projection,
        seasonProjectedPoints: projection.weeklyProjectedPoints,
      }] as const];
    }),
  );
  const lineup = selectStarters(
    currentRoster,
    weeklyProjectionsByPlayerId,
    input.leagueSettings.roster.starterSlots,
  ).lineup;
  const selectedPlayerIds = new Set(lineup.map(player => player.playerId));

  return lineup.map(start => {
    const slot = input.leagueSettings.roster.starterSlots.find(candidate => candidate.slot === start.slot);
    const startPlayer = currentRoster.players.find(player => player.playerId === start.playerId);
    if (slot === undefined || startPlayer === undefined) {
      throw new Error("Weekly starter recommendation references unavailable roster inputs.");
    }

    const projectedStart = projectedPlayer(startPlayer, projectionsByPlayerId);
    if (projectedStart === undefined) {
      throw new Error("Weekly starter recommendation references an unavailable projection.");
    }

    const projectedSit = currentRoster.players
      .filter(player => !selectedPlayerIds.has(player.playerId) && slot.eligiblePositions.includes(player.position))
      .flatMap(player => {
        const contribution = projectedPlayer(player, projectionsByPlayerId);
        return contribution === undefined ? [] : [contribution];
      })
      .sort((left, right) =>
        right.projectedPoints - left.projectedPoints || left.playerId.localeCompare(right.playerId)
      )[0];

    if (projectedSit === undefined) {
      return {
        recommendationId: `start-sit:${start.slot}:${start.playerId}`,
        slot: start.slot,
        start: projectedStart,
        explanation: `${projectedStart.playerName} is the projected starter in the ${start.slot} slot at ${projectedStart.projectedPoints} points.`,
      };
    }

    const projectedPointEdge = round(projectedStart.projectedPoints - projectedSit.projectedPoints);
    return {
      recommendationId: `start-sit:${start.slot}:${start.playerId}`,
      slot: start.slot,
      start: projectedStart,
      sit: projectedSit,
      projectedPointEdge,
      explanation: `${projectedStart.playerName} projects for ${projectedPointEdge} more points than ${projectedSit.playerName} in the ${start.slot} slot.`,
    };
  });
};

const pickupDropRecommendationRecords = (
  input: AnalyzePostDraftTeamInput,
): PickupDropRecommendationRecord[] => {
  const currentRoster = input.currentRosterSnapshot?.players;
  const freeAgents = input.freeAgentSnapshot?.players;
  if (currentRoster === undefined || freeAgents === undefined) return [];

  const projectionsByPlayerId = new Map(
    input.projectionSnapshot.projections.map(projection => [projection.playerId, projection]),
  );
  const positions = [...new Set(freeAgents.map(player => player.position))].sort();

  return positions.flatMap(position => {
    const add = freeAgents
      .filter(player => player.position === position)
      .flatMap(player => {
        const contribution = projectedPlayer(player, projectionsByPlayerId);
        return contribution === undefined ? [] : [contribution];
      })
      .sort((left, right) =>
        right.projectedPoints - left.projectedPoints || left.playerId.localeCompare(right.playerId)
      )[0];
    const drop = currentRoster
      .filter(player => player.position === position)
      .flatMap(player => {
        const contribution = projectedPlayer(player, projectionsByPlayerId);
        return contribution === undefined ? [] : [contribution];
      })
      .sort((left, right) =>
        left.projectedPoints - right.projectedPoints || left.playerId.localeCompare(right.playerId)
      )[0];

    if (add === undefined || drop === undefined) return [];
    const projectedPointGain = round(add.projectedPoints - drop.projectedPoints);
    if (projectedPointGain <= 0) return [];

    return [{
      recommendationId: `pickup-drop:${add.playerId}:${drop.playerId}`,
      add,
      drop,
      projectedPointGain,
      explanation: `${add.playerName} projects for ${projectedPointGain} more points than ${drop.playerName} this week at ${position}.`,
    }];
  }).sort((left, right) =>
    right.projectedPointGain - left.projectedPointGain ||
    left.recommendationId.localeCompare(right.recommendationId)
  );
};

const recommendationSets = (
  input: AnalyzePostDraftTeamInput,
  readiness: PostDraftTeamAnalysis["recommendationReadiness"],
): PostDraftTeamAnalysis["recommendations"] => ({
  startSit: {
    ...readiness.startSit,
    records: readiness.startSit.status === "ready" ? startSitRecommendationRecords(input) : [],
  },
  pickupDrop: {
    ...readiness.pickupDrop,
    records: readiness.pickupDrop.status === "ready" ? pickupDropRecommendationRecords(input) : [],
  },
});

const projectionProvenance = (
  input: AnalyzePostDraftTeamInput,
): PostDraftProjectionProvenance => {
  const metadata = input.projectionSnapshot.metadata;

  return {
    snapshotId: metadata.snapshotId,
    generatedAt: metadata.generatedAt,
    validThrough: metadata.validThrough,
    ...(metadata.scoringSettingsId === undefined ? {} : { scoringSettingsId: metadata.scoringSettingsId }),
    ...(metadata.week === undefined ? {} : { week: metadata.week }),
    ...(metadata.source === undefined ? {} : { source: { ...metadata.source } }),
  };
};

const assertAnalysisContext = (input: AnalyzePostDraftTeamInput): void => {
  const { ownership } = input;

  if (ownership.userId !== ownership.privateOwnerUserId) {
    throw new PostDraftTeamAnalysisError(
      "private_owner_mismatch",
      "My Team analysis must be private to the requesting user.",
    );
  }

  const sharedContexts = [
    {
      label: "league settings",
      leagueId: input.leagueSettings.leagueId,
      seasonId: input.leagueSettings.seasonId,
    },
    {
      label: "completed draft roster",
      leagueId: input.completedDraftRoster.leagueId,
      seasonId: input.completedDraftRoster.seasonId,
    },
    {
      label: "projection snapshot",
      leagueId: input.projectionSnapshot.metadata.leagueId,
      seasonId: input.projectionSnapshot.metadata.seasonId,
    },
    ...(input.currentRosterSnapshot === undefined
      ? []
      : [{
          label: "current roster snapshot",
          leagueId: input.currentRosterSnapshot.leagueId,
          seasonId: input.currentRosterSnapshot.seasonId,
        }]),
    ...(input.freeAgentSnapshot === undefined
      ? []
      : [{
          label: "free-agent snapshot",
          leagueId: input.freeAgentSnapshot.leagueId,
          seasonId: input.freeAgentSnapshot.seasonId,
        }]),
  ];
  const mismatchedContext = sharedContexts.find(context =>
    context.leagueId !== ownership.leagueId || context.seasonId !== ownership.seasonId
  );

  if (mismatchedContext !== undefined) {
    throw new PostDraftTeamAnalysisError(
      "snapshot_context_mismatch",
      `${mismatchedContext.label} does not match the owned league and season.`,
    );
  }

  const ownedRoster = input.completedDraftRoster.teams.find(team => team.teamId === ownership.teamId);
  if (ownedRoster === undefined) {
    throw new PostDraftTeamAnalysisError(
      "owned_team_missing",
      `Completed draft roster does not include owned team ${ownership.teamId}.`,
    );
  }
  if (ownedRoster.ownerId !== ownership.ownerId) {
    throw new PostDraftTeamAnalysisError(
      "owned_team_mismatch",
      `Owned team ${ownership.teamId} belongs to ${ownedRoster.ownerId}, not ${ownership.ownerId}.`,
    );
  }
  if (
    input.currentRosterSnapshot !== undefined &&
    (
      input.currentRosterSnapshot.teamId !== ownership.teamId ||
      input.currentRosterSnapshot.privateOwnerUserId !== ownership.privateOwnerUserId
    )
  ) {
    throw new PostDraftTeamAnalysisError(
      "snapshot_context_mismatch",
      "Current roster snapshot does not match the private owned team.",
    );
  }
};

const unavailableAnalysis = (
  input: AnalyzePostDraftTeamInput,
  recommendationReadiness: PostDraftTeamAnalysis["recommendationReadiness"],
  reason: TeamRankingUnavailableReason,
): PostDraftTeamAnalysis => ({
  ownership: { ...input.ownership },
  generatedAt: new Date(input.evaluatedAt),
  projectionProvenance: projectionProvenance(input),
  ranking: {
    status: "unavailable",
    teamCount: input.completedDraftRoster.teams.length,
    reasons: [reason],
  },
  strengths: [],
  risks: [],
  recommendationReadiness,
  recommendations: recommendationSets(input, recommendationReadiness),
});

export const analyzePostDraftTeam = (input: AnalyzePostDraftTeamInput): PostDraftTeamAnalysis => {
  assertAnalysisContext(input);
  const recommendationReadiness = initialRecommendationReadiness(input);
  const projectionMetadata = input.projectionSnapshot.metadata;
  if (
    projectionMetadata.scoringSettingsId === undefined ||
    projectionMetadata.source?.scoringSpecific === false
  ) {
    return unavailableAnalysis(input, recommendationReadiness, {
      code: "projection_scoring_settings_unverified",
      message: `Projection snapshot ${projectionMetadata.snapshotId} was not calculated for this league's scoring settings.`,
      projectionSnapshotId: projectionMetadata.snapshotId,
    });
  }
  if (projectionMetadata.scoringSettingsId !== input.leagueSettings.scoring.id) {
    return unavailableAnalysis(input, recommendationReadiness, {
      code: "projection_scoring_settings_mismatch",
      message: `Projection snapshot ${projectionMetadata.snapshotId} uses ${projectionMetadata.scoringSettingsId}, not ${input.leagueSettings.scoring.id}.`,
      projectionSnapshotId: projectionMetadata.snapshotId,
    });
  }

  const projectionsByPlayerId = new Map(
    input.projectionSnapshot.projections.map(projection => [projection.playerId, projection]),
  );
  const playersWithoutSeasonProjections = [...new Set(
    input.completedDraftRoster.teams.flatMap(team => team.players
      .filter(player => !Number.isFinite(projectionsByPlayerId.get(player.playerId)?.seasonProjectedPoints))
      .map(player => player.playerId)),
  )].sort();

  if (playersWithoutSeasonProjections.length > 0) {
    return unavailableAnalysis(input, recommendationReadiness, {
      code: "projection_coverage_incomplete",
      message: "Season projections do not cover every player in the completed draft roster.",
      projectionSnapshotId: input.projectionSnapshot.metadata.snapshotId,
      playerIds: playersWithoutSeasonProjections,
    });
  }

  const teamComponents = input.completedDraftRoster.teams.map(team =>
    componentValuesFor(team, input.leagueSettings.roster, projectionsByPlayerId)
  );
  const ownedRoster = input.completedDraftRoster.teams.find(team => team.teamId === input.ownership.teamId);
  if (ownedRoster === undefined) {
    throw new PostDraftTeamAnalysisError(
      "owned_team_missing",
      `Completed draft roster does not include owned team ${input.ownership.teamId}.`,
    );
  }
  const ownedTeamComponents = teamComponents.find(team => team.teamId === input.ownership.teamId);
  if (ownedTeamComponents === undefined) {
    throw new PostDraftTeamAnalysisError(
      "owned_team_missing",
      `Completed draft roster does not include owned team ${input.ownership.teamId}.`,
    );
  }
  const requiredStarterSlots = input.leagueSettings.roster.starterSlots.length;
  if (ownedRoster.players.length === 0 || ownedTeamComponents.filledSlots < requiredStarterSlots) {
    const message = ownedRoster.players.length === 0
      ? "The roster is empty, so draft rank and strengths are unavailable."
      : `The roster fills ${ownedTeamComponents.filledSlots} of ${requiredStarterSlots} required starter slots, so draft rank and strengths are unavailable.`;
    return unavailableAnalysis(input, recommendationReadiness, {
      code: "roster_materially_incomplete",
      message,
      projectionSnapshotId: input.projectionSnapshot.metadata.snapshotId,
    });
  }

  const rankedTeams = rankTeams(teamComponents);
  const ownedTeam = rankedTeams.find(team => team.teamId === input.ownership.teamId);

  if (ownedTeam === undefined) {
    throw new PostDraftTeamAnalysisError(
      "owned_team_missing",
      `Completed draft roster does not include owned team ${input.ownership.teamId}.`,
    );
  }

  const findings = findingsFor(
    ownedTeam,
    rankedTeams.length,
    input.leagueSettings.roster.starterSlots.length,
  );
  const availableBenchSlots = Math.max(
    0,
    input.leagueSettings.roster.rosterSize - input.leagueSettings.roster.starterSlots.length,
  );

  return {
    ownership: { ...input.ownership },
    generatedAt: new Date(input.evaluatedAt),
    projectionProvenance: projectionProvenance(input),
    ranking: {
      status: "available",
      rank: ownedTeam.overallRank,
      teamCount: rankedTeams.length,
      overallScore: ownedTeam.overallScore,
      components: {
        starterProjection: {
          projectedPoints: ownedTeam.starterProjectedPoints,
          filledSlots: ownedTeam.filledSlots,
          requiredSlots: input.leagueSettings.roster.starterSlots.length,
          lineup: ownedTeam.starterLineup,
          leagueRank: ownedTeam.starterRank,
          normalizedScore: ownedTeam.starterNormalizedScore,
          weight: starterWeight,
        },
        benchDepth: {
          projectedPoints: ownedTeam.benchProjectedPoints,
          countedPlayers: ownedTeam.countedBenchPlayers,
          availableBenchSlots,
          players: ownedTeam.benchPlayers,
          leagueRank: ownedTeam.benchRank,
          normalizedScore: ownedTeam.benchNormalizedScore,
          weight: benchWeight,
        },
        positionalBalance: {
          score: ownedTeam.positionalBalanceScore,
          positions: ownedTeam.positionDetails,
          leagueRank: ownedTeam.balanceRank,
          normalizedScore: ownedTeam.balanceNormalizedScore,
          weight: balanceWeight,
        },
      },
      explanation: {
        formula: rankingFormula,
        projectionSnapshotId: input.projectionSnapshot.metadata.snapshotId,
        scoringSettingsId: input.leagueSettings.scoring.id,
      },
    },
    strengths: findings.strengths,
    risks: findings.risks,
    recommendationReadiness,
    recommendations: recommendationSets(input, recommendationReadiness),
  };
};
