import type {
  MyExpertAdviceCard,
  MyExpertLeagueSettings,
  MyExpertPlayer,
  MyExpertTradeCandidate,
} from "./contracts.js";
import { slugFor } from "./formatting.js";
import { priorityForGain } from "./priorities.js";
import { bestRosterScoreFor, needsStarter } from "./rosterRules.js";
import { playerScoreWithMatchups } from "./scoring.js";

export const tradeTargetCardFor = (
  leagueSettings: MyExpertLeagueSettings,
  roster: readonly MyExpertPlayer[],
  tradeCandidates: readonly MyExpertTradeCandidate[],
  matchupScores: ReadonlyMap<string, number>,
): MyExpertAdviceCard | undefined => {
  const target = tradeCandidates
    .filter(candidate => needsStarter(leagueSettings, candidate.position) && candidate.acquisitionCost !== "high")
    .map(candidate => ({
      candidate,
      gain: playerScoreWithMatchups(candidate, matchupScores) -
        bestRosterScoreFor(roster, candidate.position, matchupScores),
    }))
    .filter(entry => entry.gain >= 3)
    .sort((left, right) =>
      right.gain - left.gain ||
      playerScoreWithMatchups(right.candidate, matchupScores) -
        playerScoreWithMatchups(left.candidate, matchupScores) ||
      left.candidate.name.localeCompare(right.candidate.name)
    )[0];
  if (!target) return undefined;

  return {
    id: `trade-target-${slugFor(target.candidate.name)}`,
    type: "trade-target",
    title: `Explore trade target ${target.candidate.name}`,
    priority: priorityForGain(target.gain),
    playerIds: [target.candidate.id],
    action: { kind: "recommendation", readOnly: true, label: "Review trade idea" },
    summary: `${target.candidate.name} would raise the ${target.candidate.position} outlook without constructing or submitting an offer.`,
    reasons: [
      `${target.candidate.name} scores ${target.gain.toFixed(1)} points above your best rostered ${target.candidate.position}.`,
      ...(target.candidate.managerNeed ? [`Other manager may need ${target.candidate.managerNeed}.`] : []),
    ],
  };
};
