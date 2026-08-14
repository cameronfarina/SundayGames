import {
  preferenceRosterCountFor,
  type ResolvedSeasonSimulationPreference,
  type SeasonSimulationPreferenceOutcome,
} from "../seasonSimulationPreferences.js";
import {
  seasonSimulationTargetOutcomeFor,
  type ResolvedSeasonSimulationTarget,
} from "../seasonSimulationTargets.js";
import type {
  CompletedSimulationRun,
  ParsedSeasonSimulationStrategy,
  SeasonSimulationResult,
} from "./contracts.js";

export const aggregateRuns = (input: {
  draftFormat: "auction" | "snake";
  runs: readonly CompletedSimulationRun[];
  runCount: number;
  seedPrefix: string;
  strategy: ParsedSeasonSimulationStrategy;
  resolvedTargets: readonly ResolvedSeasonSimulationTarget[];
  preferences: readonly ResolvedSeasonSimulationPreference[];
  pairPlayerId: string | undefined;
  humanTeamId: string;
}): SeasonSimulationResult => {
  const exposure = new Map<string, {
    playerId: string;
    playerName: string;
    position: string;
    count: number;
    priceTotal: number;
    priceCount: number;
    pickTotal: number;
    pickCount: number;
  }>();
  const positionTotals = new Map<string, number>();

  for (const run of input.runs) {
    const humanRoster = run.teams.find(team => team.teamId === input.humanTeamId)?.roster ?? [];
    for (const player of humanRoster) {
      const current = exposure.get(player.playerId) ?? {
        playerId: player.playerId,
        playerName: player.playerName,
        position: player.position,
        count: 0,
        priceTotal: 0,
        priceCount: 0,
        pickTotal: 0,
        pickCount: 0,
      };
      current.count += 1;
      if (player.price !== undefined) {
        current.priceTotal += player.price;
        current.priceCount += 1;
      }
      if (player.overallPick !== undefined) {
        current.pickTotal += player.overallPick;
        current.pickCount += 1;
      }
      exposure.set(player.playerId, current);
      positionTotals.set(player.position, (positionTotals.get(player.position) ?? 0) + 1);
    }
  }

  const playerExposure = [...exposure.values()]
    .map(player => ({
      playerId: player.playerId,
      playerName: player.playerName,
      position: player.position,
      count: player.count,
      rate: player.count / input.runCount,
      ...(player.priceCount === 0 ? {} : { averagePrice: player.priceTotal / player.priceCount }),
      ...(player.pickCount === 0 ? {} : { averagePick: player.pickTotal / player.pickCount }),
    }))
    .sort((left, right) =>
      right.count - left.count || left.playerName.localeCompare(right.playerName)
    );
  const humanRosters = input.runs.map(run =>
    run.teams.find(team => team.teamId === input.humanTeamId)?.roster ?? []
  );
  const targetOutcomes = input.resolvedTargets.map(resolvedTarget =>
    seasonSimulationTargetOutcomeFor({
      resolvedTarget,
      draftFormat: input.draftFormat,
      humanRosters,
    })
  );
  const targetOutcome = targetOutcomes[0];
  const preferenceOutcomes = input.preferences.map(preference => {
    const hitCount = input.runs.filter(run => {
      const roster = run.teams.find(team => team.teamId === input.humanTeamId)?.roster ?? [];
      return preferenceRosterCountFor(roster, preference, input.pairPlayerId)
        >= preference.targetCount;
    }).length;
    const status: SeasonSimulationPreferenceOutcome["status"] = hitCount === input.runCount
      ? "hit"
      : preference.feasible ? "miss" : "infeasible";
    const label = `${preference.preference.tier.charAt(0).toUpperCase()}${preference.preference.tier.slice(1)} ${preference.preference.position}`;
    const message = status === "hit"
      ? `${label} preference hit in ${hitCount}/${input.runCount} runs.`
      : status === "miss"
        ? `${label} preference missed in ${input.runCount - hitCount}/${input.runCount} runs.`
        : `${label} preference is infeasible under the recorded tier rule and constraints.`;

    return {
      position: preference.preference.position,
      tier: preference.preference.tier,
      targetCount: preference.targetCount,
      status,
      feasible: preference.feasible,
      hitCount,
      hitRate: hitCount / input.runCount,
      rule: preference.rule,
      message,
    };
  });

  return {
    draftFormat: input.draftFormat,
    runCount: input.runCount,
    completedCount: input.runs.length,
    seedPrefix: input.seedPrefix,
    strategy: input.strategy,
    ...(targetOutcomes.length === 0 ? {} : { targetOutcomes }),
    ...(targetOutcome === undefined ? {} : { targetOutcome }),
    ...(preferenceOutcomes.length === 0 ? {} : { preferenceOutcomes }),
    playerExposure,
    positionCounts: Object.fromEntries([...positionTotals.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([position, total]) => [position, { total, perRun: total / input.runCount }])),
    runs: input.runs.map(run => ({
      runNumber: run.runNumber,
      label: `Run ${run.runNumber}`,
      seed: run.seed,
      teams: run.teams,
    })),
  };
};
