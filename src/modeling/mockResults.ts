import type { Owner, Position } from "../../config/league.js";
import { ownerOrder, primaryOwner } from "../../config/league.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";
import { lineupScore, optimizeLineup, playerMetricValue } from "../lineupOptimizer.js";
import type { LineupEntry, Player, StarterSlot } from "../types.js";
import type { MockBatch, MockBatchSummary, MockRosterSummary, MockRun } from "./mockBatch.js";
import type { MockDraftScript, MockDraftScriptTargetMaxBid } from "./mockScript.js";
import type { LiveDraftStrategyKey } from "./liveDraftStrategies.js";
import {
  buildDraftPlanReport,
  type DraftPlanStrategyCoach,
  type DraftPlanStrategyKey,
} from "./draftPlan.js";

export type MockResultsPlayerSlot = StarterSlot | "BENCH";

export interface MockResultsPlayer {
  name: string;
  position: Position;
  slot: MockResultsPlayerSlot;
  price: number;
  week1: number;
  weeks1To4: number;
  seasonProjection: number;
  starter: boolean;
}

export interface MockResultsTeam {
  owner: Owner;
  spend: number;
  budgetRemaining: number;
  week1Score: number;
  weeks1To4Score: number;
  starterSeasonScore: number;
  depthScore: number;
  consistencyScore: number;
  seasonStrengthScore: number;
  valid: boolean;
  errors: string[];
  starters: MockResultsPlayer[];
  bench: MockResultsPlayer[];
  players: MockResultsPlayer[];
  projectedRank?: number;
  projectedFinishLabel?: string;
  rankExplanation?: string;
  topStarter?: MockResultsPlayer;
  bestValue?: MockResultsPlayer;
  corePlayers?: MockResultsPlayer[];
  strengths?: string[];
  risks?: string[];
}

export interface MockResultsRanking {
  rank: number;
  owner: Owner;
  week1Score: number;
  weeks1To4Score: number;
  week1Rank: number;
  starterSeasonScore: number;
  depthScore: number;
  consistencyScore: number;
  seasonStrengthScore: number;
  projectedFinishScore: number;
  projectedFinishLabel: string;
  explanation: string;
  strengths: string[];
  risks: string[];
}

export interface MockResultsBuildSummary {
  owner: Owner;
  rank: number;
  headline: string;
  week1Score: number;
  weeks1To4Score: number;
  seasonStrengthScore: number;
  spend: number;
  budgetRemaining: number;
  corePlayers: string[];
}

export interface MockResultsCamOutcome extends MockResultsBuildSummary {
  week1Rank: number;
  strengths: string[];
  risks: string[];
}

export interface MockResultsStrategyAnalytics {
  strategyKey: LiveDraftStrategyKey;
  runCount: number;
  averageCamRank: number;
  bestCamRank: number;
  worstCamRank: number;
  averageCamWeek1Score: number;
  averageCamWeeks1To4Score: number;
  averageCamSeasonStrengthScore: number;
  averageCamSpend: number;
}

export interface MockResultsCamScoreRange {
  minimumWeek1Score: number;
  maximumWeek1Score: number;
  averageWeek1Score: number;
  minimumWeeks1To4Score: number;
  maximumWeeks1To4Score: number;
  averageWeeks1To4Score: number;
  bestRunLabel: string;
  worstRunLabel: string;
}

export interface MockResultsRosterPath {
  path: string;
  corePlayers: string[];
  count: number;
  draftedRate: number;
  averageWeek1Score: number;
  averageWeeks1To4Score: number;
  averageRank: number;
}

export interface MockResultsAnalytics {
  strategyLeaderboard: MockResultsStrategyAnalytics[];
  camScoreRange: MockResultsCamScoreRange;
  topCamRosterPaths: MockResultsRosterPath[];
  strategyCoach?: DraftPlanStrategyCoach;
}

export interface MockResultsScriptTargetOutcome {
  owner: Owner;
  player: string;
  maxBid: number;
  runCount: number;
  draftedByOwnerCount: number;
  draftedByOwnerRate: number;
  draftedByOtherCount: number;
  undraftedCount: number;
  missedCount: number;
  averageSalePrice: number;
  minimumSalePrice: number;
  maximumSalePrice: number;
  averageOwnerRankWhenDrafted: number;
  averageOwnerWeek1WhenDrafted: number;
  averageOwnerSeasonStrengthWhenDrafted: number;
}

export interface MockResultsScriptBuildAroundOutcome {
  owner: Owner;
  player: string;
  price: number;
  runCount: number;
  draftedByOwnerCount: number;
  draftedByOwnerRate: number;
  draftedByOtherCount: number;
  undraftedCount: number;
  averageSalePrice: number;
  minimumSalePrice: number;
  maximumSalePrice: number;
  averageCamRank: number;
  averageCamWeek1Score: number;
  averageCamWeeks1To4Score: number;
  averageCamSeasonStrengthScore: number;
  averageCamBudgetRemaining: number;
  bestRunLabel: string;
  worstRunLabel: string;
}

export interface MockResultsScriptSummary {
  raw: string;
  label: string;
  buildAround?: MockDraftScript["buildAround"];
  buildAroundOutcomes?: MockResultsScriptBuildAroundOutcome[];
  targetMaxBids: MockDraftScriptTargetMaxBid[];
  targetOutcomes: MockResultsScriptTargetOutcome[];
  runsPerScenario?: number;
}

export interface MockResultsRun {
  index: number;
  label: string;
  seed: string;
  strategyKey: LiveDraftStrategyKey;
  scenarioLabel: string;
  teams: MockResultsTeam[];
  rankings: MockResultsRanking[];
  bestBuild: MockResultsBuildSummary;
  worstBuild: MockResultsBuildSummary;
  camOutcome: MockResultsCamOutcome;
}

export interface MockResultsReport {
  mode: "batch-mock";
  watchOwner: Owner;
  options: MockBatch["options"] & {
    strategyKey: LiveDraftStrategyKey;
  };
  summary: MockBatchSummary;
  runStrategyKeys: LiveDraftStrategyKey[];
  runs: MockResultsRun[];
  analytics: MockResultsAnalytics;
  script?: MockResultsScriptSummary;
  cam?: MockBatchSummary["owners"][number];
  camTopExposures: MockBatchSummary["ownerPlayerExposure"];
  topPlayers: MockBatchSummary["players"];
}

const starterSlotOrder: Record<StarterSlot, number> = {
  QB: 1,
  RB1: 2,
  RB2: 3,
  WR1: 4,
  WR2: 5,
  TE: 6,
  FLEX: 7,
  K: 8,
  DST: 9,
};

const positionOrder: Record<Position, number> = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 4,
  K: 5,
  DST: 6,
};

const strategyShortName = (strategyKey: LiveDraftStrategyKey): string => {
  if (strategyKey === "three-rb") return "3rb";
  if (strategyKey === "hero-rb") return "hero rb";
  if (strategyKey === "wr-heavy") return "wr heavy";
  return "balanced";
};

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const average = (values: readonly number[]): number =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;

const ordinal = (rank: number): string => {
  const lastTwo = rank % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${rank}th`;
  if (rank % 10 === 1) return `${rank}st`;
  if (rank % 10 === 2) return `${rank}nd`;
  if (rank % 10 === 3) return `${rank}rd`;
  return `${rank}th`;
};

const scoreText = (value: number): string =>
  roundToTwo(value).toFixed(1);

const moneyText = (value: number): string =>
  `$${Math.round(value)}`;

const playerResultFor = (
  player: Player,
  slot: MockResultsPlayerSlot,
  starter: boolean,
): MockResultsPlayer => ({
  name: player.name,
  position: player.position,
  slot,
  price: player.price,
  week1: roundToTwo(player.week1),
  weeks1To4: roundToTwo(player.weeks1To4),
  seasonProjection: roundToTwo(playerMetricValue(player, "seasonProjection")),
  starter,
});

const optimizedWeekOneLineup = (roster: MockRosterSummary): LineupEntry[] =>
  optimizeLineup({ strategy: "mock-results", players: roster.players }, "week1")
    .sort((left, right) => starterSlotOrder[left.slot] - starterSlotOrder[right.slot]);

const benchPlayersFor = (
  roster: MockRosterSummary,
  starters: readonly LineupEntry[],
): MockResultsPlayer[] => {
  const starterNames = new Set(starters.map(entry => entry.player.name));
  return roster.players
    .filter(player => !starterNames.has(player.name))
    .sort(
      (left, right) =>
        positionOrder[left.position] - positionOrder[right.position] ||
        right.week1 - left.week1 ||
        right.price - left.price ||
        left.name.localeCompare(right.name),
    )
    .map(player => playerResultFor(player, "BENCH", false));
};

const seasonLineupFor = (roster: MockRosterSummary): LineupEntry[] =>
  optimizeLineup({ strategy: "mock-results-season", players: roster.players }, "seasonProjection");

const depthScoreFor = (
  roster: MockRosterSummary,
  seasonLineup: readonly LineupEntry[],
): number => {
  const starterNames = new Set(seasonLineup.map(entry => entry.player.name));
  const weights = [0.16, 0.12, 0.09, 0.06, 0.04] as const;
  const depthPlayers = roster.players
    .filter(player => !starterNames.has(player.name))
    .filter(player => player.position !== "K" && player.position !== "DST")
    .sort(
      (left, right) =>
        playerMetricValue(right, "seasonProjection") - playerMetricValue(left, "seasonProjection") ||
        right.week1 - left.week1 ||
        left.name.localeCompare(right.name),
    )
    .slice(0, weights.length);

  return roundToTwo(depthPlayers.reduce(
    (total, player, index) => total + playerMetricValue(player, "seasonProjection") * (weights[index] ?? 0),
    0,
  ));
};

const consistencyScoreFor = (seasonLineup: readonly LineupEntry[]): number =>
  roundToTwo(seasonLineup.reduce((total, entry) => {
    const weekOnePace = entry.player.week1 * 17;
    const seasonProjection = playerMetricValue(entry.player, "seasonProjection");
    const strongerProjection = Math.max(weekOnePace, seasonProjection, 1);
    const steadiness = Math.min(weekOnePace, seasonProjection) / strongerProjection;
    return total + steadiness * 1.5;
  }, 0));

const teamResultFor = (roster: MockRosterSummary): MockResultsTeam => {
  const starters = optimizedWeekOneLineup(roster);
  const seasonLineup = seasonLineupFor(roster);
  const weeksOneToFourLineup = optimizeLineup(
    { strategy: "mock-results-weeks-1-4", players: roster.players },
    "weeks1To4",
  );
  const starterPlayers = starters.map(entry => playerResultFor(entry.player, entry.slot, true));
  const bench = benchPlayersFor(roster, starters);
  const weeks1To4Score = roundToTwo(roster.weeks1To4Score ?? lineupScore(weeksOneToFourLineup, "weeks1To4"));
  const starterSeasonScore = roundToTwo(lineupScore(seasonLineup, "seasonProjection"));
  const depthScore = depthScoreFor(roster, seasonLineup);
  const consistencyScore = consistencyScoreFor(seasonLineup);

  return {
    owner: roster.owner,
    spend: roster.spend,
    budgetRemaining: roster.budgetRemaining,
    week1Score: roundToTwo(lineupScore(starters, "week1")),
    weeks1To4Score,
    starterSeasonScore,
    depthScore,
    consistencyScore,
    seasonStrengthScore: roundToTwo(starterSeasonScore + depthScore + consistencyScore),
    valid: roster.valid,
    errors: roster.errors,
    starters: starterPlayers,
    bench,
    players: [...starterPlayers, ...bench],
  };
};

const topStarterFor = (team: MockResultsTeam): MockResultsPlayer | undefined =>
  [...team.starters].sort(
    (left, right) =>
      right.week1 - left.week1 ||
      right.seasonProjection - left.seasonProjection ||
      right.price - left.price ||
      left.name.localeCompare(right.name),
  )[0];

const bestValueFor = (team: MockResultsTeam): MockResultsPlayer | undefined =>
  [...team.players].sort(
    (left, right) =>
      (right.week1 / Math.max(1, right.price)) - (left.week1 / Math.max(1, left.price)) ||
      right.week1 - left.week1 ||
      left.name.localeCompare(right.name),
  )[0];

const corePlayersFor = (team: MockResultsTeam): MockResultsPlayer[] =>
  [...team.starters]
    .sort(
      (left, right) =>
        right.week1 - left.week1 ||
        right.seasonProjection - left.seasonProjection ||
        right.price - left.price ||
        left.name.localeCompare(right.name),
    )
    .slice(0, 3);

const baseRankingTeams = (teams: readonly MockResultsTeam[]): MockResultsTeam[] =>
  [...teams]
    .sort(
      (left, right) =>
        right.seasonStrengthScore - left.seasonStrengthScore ||
        right.weeks1To4Score - left.weeks1To4Score ||
        right.week1Score - left.week1Score ||
        left.owner.localeCompare(right.owner),
    );

const weekOneRankByOwner = (teams: readonly MockResultsTeam[]): Map<Owner, number> =>
  new Map([...teams]
    .sort(
      (left, right) =>
        right.week1Score - left.week1Score ||
        right.weeks1To4Score - left.weeks1To4Score ||
        left.owner.localeCompare(right.owner),
    )
    .map((team, index) => [team.owner, index + 1]));

const strengthNotesFor = (
  team: MockResultsTeam,
  week1Rank: number,
): string[] => {
  const topStarter = topStarterFor(team);
  const bestValue = bestValueFor(team);
  const notes = [
    `Week 1 rank ${ordinal(week1Rank)}`,
  ];

  if (topStarter) notes.push(`Top starter ${topStarter.name} at ${scoreText(topStarter.week1)} W1`);
  notes.push(`Season strength ${scoreText(team.seasonStrengthScore)}`);
  notes.push(`Depth ${scoreText(team.depthScore)} / consistency ${scoreText(team.consistencyScore)}`);
  if (bestValue) notes.push(`Best value ${bestValue.name} at ${moneyText(bestValue.price)}`);
  return notes;
};

const riskNotesFor = (
  team: MockResultsTeam,
  rank: number,
  leaderScore: number,
): string[] => {
  const risks: string[] = [];
  const leaderGap = roundToTwo(leaderScore - team.seasonStrengthScore);
  if (rank > 7) risks.push(`Needs ${scoreText(leaderGap)} points of upside to catch the lead`);
  if (team.budgetRemaining <= 1) risks.push("No budget cushion after the draft");
  if (!team.valid) risks.push(team.errors[0] ?? "Roster validation warning");
  return risks.length ? risks : ["No major roster-shape warning in this run"];
};

const rankingsFor = (teams: readonly MockResultsTeam[]): MockResultsRanking[] => {
  const rankedTeams = baseRankingTeams(teams);
  const week1Ranks = weekOneRankByOwner(teams);
  const leader = rankedTeams[0];
  const leaderScore = leader?.seasonStrengthScore ?? 0;
  const runnerUp = rankedTeams[1];

  return rankedTeams.map((team, index) => {
    const rank = index + 1;
    const week1Rank = week1Ranks.get(team.owner) ?? rank;
    const gapToLeader = roundToTwo(leaderScore - team.seasonStrengthScore);
    const margin = rank === 1 && runnerUp
      ? roundToTwo(team.seasonStrengthScore - runnerUp.seasonStrengthScore)
      : gapToLeader;
    const explanation = rank === 1
      ? `Projected 1st by season strength, ${scoreText(margin)} ahead of the field; Week 1 rank ${ordinal(week1Rank)}.`
      : `Projected ${ordinal(rank)} by season strength, ${scoreText(gapToLeader)} behind the leader; Week 1 rank ${ordinal(week1Rank)}.`;

    return {
      rank: index + 1,
      owner: team.owner,
      week1Score: team.week1Score,
      weeks1To4Score: team.weeks1To4Score,
      week1Rank,
      starterSeasonScore: team.starterSeasonScore,
      depthScore: team.depthScore,
      consistencyScore: team.consistencyScore,
      seasonStrengthScore: team.seasonStrengthScore,
      projectedFinishScore: team.seasonStrengthScore,
      projectedFinishLabel: ordinal(rank),
      explanation,
      strengths: strengthNotesFor(team, week1Rank),
      risks: riskNotesFor(team, rank, leaderScore),
    };
  });
};

const applyTeamIntelligence = (
  teams: readonly MockResultsTeam[],
  rankings: readonly MockResultsRanking[],
): MockResultsTeam[] => {
  const rankingByOwner = new Map(rankings.map(ranking => [ranking.owner, ranking]));

  return teams.map(team => {
    const ranking = rankingByOwner.get(team.owner);
    if (!ranking) throw new Error(`Missing ranking for ${team.owner}.`);
    const topStarter = topStarterFor(team);
    const bestValue = bestValueFor(team);
    return {
      ...team,
      projectedRank: ranking.rank,
      projectedFinishLabel: ranking.projectedFinishLabel,
      rankExplanation: ranking.explanation,
      ...(topStarter === undefined ? {} : { topStarter }),
      ...(bestValue === undefined ? {} : { bestValue }),
      corePlayers: corePlayersFor(team),
      strengths: ranking.strengths,
      risks: ranking.risks,
    };
  });
};

const buildSummaryFor = (
  team: MockResultsTeam,
  ranking: MockResultsRanking,
): MockResultsBuildSummary => ({
  owner: team.owner,
  rank: ranking.rank,
  headline: `${team.owner} projected ${ranking.projectedFinishLabel} with ${scoreText(team.seasonStrengthScore)} season-strength score`,
  week1Score: team.week1Score,
  weeks1To4Score: team.weeks1To4Score,
  seasonStrengthScore: team.seasonStrengthScore,
  spend: team.spend,
  budgetRemaining: team.budgetRemaining,
  corePlayers: (team.corePlayers ?? corePlayersFor(team)).map(player => player.name),
});

const camOutcomeFor = (
  teams: readonly MockResultsTeam[],
  rankings: readonly MockResultsRanking[],
  watchOwner: Owner,
): MockResultsCamOutcome => {
  const camTeam = teams.find(team => team.owner === watchOwner);
  const camRanking = rankings.find(ranking => ranking.owner === watchOwner);
  if (!camTeam || !camRanking) throw new Error(`Missing ${watchOwner} mock result.`);

  return {
    ...buildSummaryFor(camTeam, camRanking),
    week1Rank: weekOneRankByOwner(teams).get(watchOwner) ?? camRanking.rank,
    strengths: camRanking.strengths,
    risks: camRanking.risks,
  };
};

const strategyLeaderboardFor = (runs: readonly MockResultsRun[]): MockResultsStrategyAnalytics[] => {
  const runsByStrategy = new Map<LiveDraftStrategyKey, MockResultsRun[]>();
  for (const run of runs) {
    runsByStrategy.set(run.strategyKey, [...(runsByStrategy.get(run.strategyKey) ?? []), run]);
  }

  return [...runsByStrategy.entries()]
    .map(([strategyKey, strategyRuns]) => {
      const camOutcomes = strategyRuns.map(run => run.camOutcome);
      const camRanks = camOutcomes.map(outcome => outcome.rank);
      return {
        strategyKey,
        runCount: strategyRuns.length,
        averageCamRank: roundToTwo(average(camRanks)),
        bestCamRank: Math.min(...camRanks),
        worstCamRank: Math.max(...camRanks),
        averageCamWeek1Score: roundToTwo(average(camOutcomes.map(outcome => outcome.week1Score))),
        averageCamWeeks1To4Score: roundToTwo(average(camOutcomes.map(outcome => outcome.weeks1To4Score))),
        averageCamSeasonStrengthScore: roundToTwo(average(camOutcomes.map(outcome => outcome.seasonStrengthScore))),
        averageCamSpend: roundToTwo(average(camOutcomes.map(outcome => outcome.spend))),
      };
    })
    .sort(
      (left, right) =>
        left.averageCamRank - right.averageCamRank ||
        right.averageCamSeasonStrengthScore - left.averageCamSeasonStrengthScore ||
        right.averageCamWeeks1To4Score - left.averageCamWeeks1To4Score ||
        left.strategyKey.localeCompare(right.strategyKey),
    );
};

const camScoreRangeFor = (runs: readonly MockResultsRun[]): MockResultsCamScoreRange => {
  const sortedByCamScore = [...runs].sort(
    (left, right) =>
      right.camOutcome.seasonStrengthScore - left.camOutcome.seasonStrengthScore ||
      right.camOutcome.weeks1To4Score - left.camOutcome.weeks1To4Score ||
      right.camOutcome.week1Score - left.camOutcome.week1Score ||
      left.label.localeCompare(right.label),
  );
  const bestRun = sortedByCamScore[0];
  const worstRun = sortedByCamScore[sortedByCamScore.length - 1];
  if (!bestRun || !worstRun) throw new Error("Cannot build mock analytics without runs.");

  const week1Scores = runs.map(run => run.camOutcome.week1Score);
  const weeks1To4Scores = runs.map(run => run.camOutcome.weeks1To4Score);
  return {
    minimumWeek1Score: roundToTwo(Math.min(...week1Scores)),
    maximumWeek1Score: roundToTwo(Math.max(...week1Scores)),
    averageWeek1Score: roundToTwo(average(week1Scores)),
    minimumWeeks1To4Score: roundToTwo(Math.min(...weeks1To4Scores)),
    maximumWeeks1To4Score: roundToTwo(Math.max(...weeks1To4Scores)),
    averageWeeks1To4Score: roundToTwo(average(weeks1To4Scores)),
    bestRunLabel: bestRun.label,
    worstRunLabel: worstRun.label,
  };
};

const topCamRosterPathsFor = (runs: readonly MockResultsRun[]): MockResultsRosterPath[] => {
  const pathGroups = new Map<string, {
    corePlayers: string[];
    outcomes: MockResultsCamOutcome[];
  }>();

  for (const run of runs) {
    const corePlayers = run.camOutcome.corePlayers;
    const path = corePlayers.join(" / ");
    const group = pathGroups.get(path) ?? { corePlayers, outcomes: [] };
    group.outcomes.push(run.camOutcome);
    pathGroups.set(path, group);
  }

  return [...pathGroups.entries()]
    .map(([path, group]) => ({
      path,
      corePlayers: group.corePlayers,
      count: group.outcomes.length,
      draftedRate: roundToTwo(group.outcomes.length / runs.length),
      averageWeek1Score: roundToTwo(average(group.outcomes.map(outcome => outcome.week1Score))),
      averageWeeks1To4Score: roundToTwo(average(group.outcomes.map(outcome => outcome.weeks1To4Score))),
      averageRank: roundToTwo(average(group.outcomes.map(outcome => outcome.rank))),
    }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.averageRank - right.averageRank ||
        right.averageWeeks1To4Score - left.averageWeeks1To4Score ||
        left.path.localeCompare(right.path),
    )
    .slice(0, 8);
};

const isDraftPlanStrategyKey = (strategyKey: LiveDraftStrategyKey): strategyKey is DraftPlanStrategyKey =>
  strategyKey === "three-rb";

const strategyCoachFor = (
  batch: MockBatch,
  strategyKey: LiveDraftStrategyKey,
  watchOwner: Owner,
): DraftPlanStrategyCoach | undefined =>
  isDraftPlanStrategyKey(strategyKey)
    ? buildDraftPlanReport({
      batch,
      owner: watchOwner,
      strategyKey,
      limit: 5,
    }).recommendations.strategyCoach
    : undefined;

const analyticsFor = (
  runs: readonly MockResultsRun[],
  batch: MockBatch,
  strategyKey: LiveDraftStrategyKey,
  watchOwner: Owner,
): MockResultsAnalytics => {
  const strategyCoach = strategyCoachFor(batch, strategyKey, watchOwner);

  return {
    strategyLeaderboard: strategyLeaderboardFor(runs),
    camScoreRange: camScoreRangeFor(runs),
    topCamRosterPaths: topCamRosterPathsFor(runs),
    ...(strategyCoach === undefined ? {} : { strategyCoach }),
  };
};

const rosteredTargetFor = (
  run: MockResultsRun,
  playerName: string,
): { owner: Owner; price: number; team: MockResultsTeam } | undefined => {
  const normalized = normalizePlayerName(playerName);

  for (const team of run.teams) {
    const player = team.players.find(candidate => normalizePlayerName(candidate.name) === normalized);
    if (player) return { owner: team.owner, price: player.price, team };
  }

  return undefined;
};

const scriptTargetOutcomeFor = (
  target: MockDraftScriptTargetMaxBid,
  runs: readonly MockResultsRun[],
): MockResultsScriptTargetOutcome => {
  const rosteredTargets = runs
    .map(run => rosteredTargetFor(run, target.player))
    .filter((result): result is { owner: Owner; price: number; team: MockResultsTeam } => result !== undefined);
  const ownerTargets = rosteredTargets.filter(result => result.owner === target.owner);
  const salePrices = rosteredTargets.map(result => result.price);

  return {
    owner: target.owner,
    player: target.player,
    maxBid: target.maxBid,
    runCount: runs.length,
    draftedByOwnerCount: ownerTargets.length,
    draftedByOwnerRate: roundToTwo(ownerTargets.length / Math.max(1, runs.length)),
    draftedByOtherCount: rosteredTargets.length - ownerTargets.length,
    undraftedCount: runs.length - rosteredTargets.length,
    missedCount: runs.length - ownerTargets.length,
    averageSalePrice: roundToTwo(average(salePrices)),
    minimumSalePrice: salePrices.length === 0 ? 0 : Math.min(...salePrices),
    maximumSalePrice: salePrices.length === 0 ? 0 : Math.max(...salePrices),
    averageOwnerRankWhenDrafted: roundToTwo(average(ownerTargets.map(result => result.team.projectedRank ?? 0))),
    averageOwnerWeek1WhenDrafted: roundToTwo(average(ownerTargets.map(result => result.team.week1Score))),
    averageOwnerSeasonStrengthWhenDrafted: roundToTwo(average(ownerTargets.map(result => result.team.seasonStrengthScore))),
  };
};

const compareBestCamOutcomeRuns = (
  left: MockResultsRun,
  right: MockResultsRun,
): number =>
  left.camOutcome.rank - right.camOutcome.rank ||
  right.camOutcome.seasonStrengthScore - left.camOutcome.seasonStrengthScore ||
  right.camOutcome.week1Score - left.camOutcome.week1Score ||
  left.label.localeCompare(right.label);

const compareWorstCamOutcomeRuns = (
  left: MockResultsRun,
  right: MockResultsRun,
): number =>
  right.camOutcome.rank - left.camOutcome.rank ||
  left.camOutcome.seasonStrengthScore - right.camOutcome.seasonStrengthScore ||
  left.camOutcome.week1Score - right.camOutcome.week1Score ||
  left.label.localeCompare(right.label);

const scriptBuildAroundOutcomesFor = (
  script: MockDraftScript,
  runs: readonly MockResultsRun[],
  runsPerPricePoint: number,
): MockResultsScriptBuildAroundOutcome[] => {
  const buildAround = script.buildAround;
  if (!buildAround) return [];

  const safeRunsPerPricePoint = Math.max(1, Math.floor(runsPerPricePoint));
  return buildAround.prices.map((price, priceIndex) => {
    const priceRuns = runs.slice(
      priceIndex * safeRunsPerPricePoint,
      (priceIndex + 1) * safeRunsPerPricePoint,
    );
    const rosteredTargets = priceRuns
      .map(run => rosteredTargetFor(run, buildAround.player))
      .filter((result): result is { owner: Owner; price: number; team: MockResultsTeam } => result !== undefined);
    const ownerTargets = rosteredTargets.filter(result => result.owner === buildAround.owner);
    const salePrices = rosteredTargets.map(result => result.price);
    const bestRun = [...priceRuns].sort(compareBestCamOutcomeRuns)[0];
    const worstRun = [...priceRuns].sort(compareWorstCamOutcomeRuns)[0];

    return {
      owner: buildAround.owner,
      player: buildAround.player,
      price,
      runCount: priceRuns.length,
      draftedByOwnerCount: ownerTargets.length,
      draftedByOwnerRate: roundToTwo(ownerTargets.length / Math.max(1, priceRuns.length)),
      draftedByOtherCount: rosteredTargets.length - ownerTargets.length,
      undraftedCount: priceRuns.length - rosteredTargets.length,
      averageSalePrice: roundToTwo(average(salePrices)),
      minimumSalePrice: salePrices.length === 0 ? 0 : Math.min(...salePrices),
      maximumSalePrice: salePrices.length === 0 ? 0 : Math.max(...salePrices),
      averageCamRank: roundToTwo(average(priceRuns.map(run => run.camOutcome.rank))),
      averageCamWeek1Score: roundToTwo(average(priceRuns.map(run => run.camOutcome.week1Score))),
      averageCamWeeks1To4Score: roundToTwo(average(priceRuns.map(run => run.camOutcome.weeks1To4Score))),
      averageCamSeasonStrengthScore: roundToTwo(average(priceRuns.map(run => run.camOutcome.seasonStrengthScore))),
      averageCamBudgetRemaining: roundToTwo(average(priceRuns.map(run => run.camOutcome.budgetRemaining))),
      bestRunLabel: bestRun?.label ?? "",
      worstRunLabel: worstRun?.label ?? "",
    };
  });
};

const scriptSummaryFor = (
  script: MockDraftScript,
  runs: readonly MockResultsRun[],
  runsPerPricePoint: number,
): MockResultsScriptSummary => ({
  raw: script.raw,
  label: script.label,
  ...(script.buildAround === undefined
    ? {}
    : {
      buildAround: script.buildAround,
      buildAroundOutcomes: scriptBuildAroundOutcomesFor(script, runs, runsPerPricePoint),
    }),
  targetMaxBids: [...script.targetMaxBids],
  targetOutcomes: script.targetMaxBids.map(target => scriptTargetOutcomeFor(target, runs)),
  ...(script.runsPerScenario === undefined ? {} : { runsPerScenario: script.runsPerScenario }),
});

const runResultFor = (
  run: MockRun,
  index: number,
  strategyKey: LiveDraftStrategyKey,
  label?: string,
  watchOwner: Owner = primaryOwner,
): MockResultsRun => {
  const baseTeams = ownerOrder.map(owner => {
    const roster = run.rosters.find(candidate => candidate.owner === owner);
    if (!roster) throw new Error(`Missing ${owner} roster for mock result run ${index + 1}.`);
    return teamResultFor(roster);
  });
  const rankings = rankingsFor(baseTeams);
  const teams = applyTeamIntelligence(baseTeams, rankings);
  const enrichedRankings = rankingsFor(teams);
  const bestRanking = enrichedRankings[0];
  const worstRanking = enrichedRankings[enrichedRankings.length - 1];
  if (!bestRanking || !worstRanking) throw new Error(`Missing rankings for mock result run ${index + 1}.`);
  const bestTeam = teams.find(team => team.owner === bestRanking.owner);
  const worstTeam = teams.find(team => team.owner === worstRanking.owner);
  if (!bestTeam || !worstTeam) throw new Error(`Missing ranked team for mock result run ${index + 1}.`);

  return {
    index: index + 1,
    label: label ?? `Run ${index + 1}: ${strategyShortName(strategyKey)}`,
    seed: run.seed,
    strategyKey,
    scenarioLabel: run.keeperScenario.label,
    teams,
    rankings: enrichedRankings,
    bestBuild: buildSummaryFor(bestTeam, bestRanking),
    worstBuild: buildSummaryFor(worstTeam, worstRanking),
    camOutcome: camOutcomeFor(teams, enrichedRankings, watchOwner),
  };
};

export const buildMockResultsReport = (
  batch: MockBatch,
  strategyKey: LiveDraftStrategyKey,
  runStrategyKeys: readonly LiveDraftStrategyKey[] = [],
  script?: MockDraftScript,
  runLabels: readonly string[] = [],
  watchOwner: Owner = primaryOwner,
): MockResultsReport => {
  const cam = batch.summary.owners.find(owner => owner.owner === watchOwner);
  const resolvedRunStrategyKeys = batch.runs.map((_run, index) => runStrategyKeys[index] ?? strategyKey);
  const runs = batch.runs.map((run, index) =>
    runResultFor(run, index, resolvedRunStrategyKeys[index] ?? strategyKey, runLabels[index], watchOwner));

  return {
    mode: "batch-mock",
    watchOwner,
    options: {
      ...batch.options,
      strategyKey,
    },
    summary: batch.summary,
    runStrategyKeys: resolvedRunStrategyKeys,
    runs,
    analytics: analyticsFor(runs, batch, strategyKey, watchOwner),
    ...(script === undefined ? {} : { script: scriptSummaryFor(script, runs, batch.options.runsPerScenario) }),
    ...(cam === undefined ? {} : { cam }),
    camTopExposures: batch.summary.ownerPlayerExposure
      .filter(exposure => exposure.owner === watchOwner)
      .slice(0, 12),
    topPlayers: batch.summary.players.slice(0, 12),
  };
};
