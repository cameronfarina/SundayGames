import type { Owner } from "../../../config/league.js";
import { ownerOrder } from "../../../config/league.js";
import type { MockRun } from "../mockBatch.js";
import type { LiveDraftStrategyKey } from "../liveDraftStrategies.js";
import { rankingsFor } from "./rankings.js";
import type { MockResultsRun } from "./reportContracts.js";
import {
  applyTeamIntelligence,
  buildSummaryFor,
  camOutcomeFor,
} from "./teamSummaries.js";
import { teamResultFor } from "./teamScoring.js";

const strategyShortName = (strategyKey: LiveDraftStrategyKey): string => {
  if (strategyKey === "three-rb") return "3rb";
  if (strategyKey === "hero-rb") return "hero rb";
  if (strategyKey === "wr-heavy") return "wr heavy";
  return "balanced";
};

export const runResultFor = (
  run: MockRun,
  index: number,
  strategyKey: LiveDraftStrategyKey,
  label: string | undefined,
  watchOwner: Owner,
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
  if (!bestRanking || !worstRanking) {
    throw new Error(`Missing rankings for mock result run ${index + 1}.`);
  }
  const bestTeam = teams.find(team => team.owner === bestRanking.owner);
  const worstTeam = teams.find(team => team.owner === worstRanking.owner);
  if (!bestTeam || !worstTeam) {
    throw new Error(`Missing ranked team for mock result run ${index + 1}.`);
  }

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
