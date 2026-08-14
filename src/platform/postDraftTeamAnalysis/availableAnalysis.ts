import type { PostDraftTeamAnalysis } from "./contracts/analysis.js";
import type { AnalyzePostDraftTeamInput } from "./contracts/projections.js";
import { balanceWeight, benchWeight, rankingFormula, starterWeight } from "./constants.js";
import { findingsFor } from "./findings.js";
import type { RankedTeam } from "./internalTypes.js";
import { projectionProvenance } from "./provenance.js";
import { recommendationSets } from "./recommendations/sets.js";

export const availableAnalysis = (
  input: AnalyzePostDraftTeamInput,
  ownedTeam: RankedTeam,
  rankedTeams: readonly RankedTeam[],
  readiness: PostDraftTeamAnalysis["recommendationReadiness"],
): PostDraftTeamAnalysis => {
  const requiredSlots = input.leagueSettings.roster.starterSlots.length;
  const availableBenchSlots = Math.max(0, input.leagueSettings.roster.rosterSize - requiredSlots);
  const findings = findingsFor(ownedTeam, rankedTeams.length, requiredSlots);
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
          requiredSlots,
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
    recommendationReadiness: readiness,
    recommendations: recommendationSets(input, readiness),
  };
};
