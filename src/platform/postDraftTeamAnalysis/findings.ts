import type { RosterAnalysisFinding } from "./contracts/ranking.js";
import type { RankedTeam } from "./internalTypes.js";

export const findingsFor = (
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
