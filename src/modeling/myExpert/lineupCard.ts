import type { Position } from "../../../config/league.js";
import {
  flexEligiblePositions,
  highLineupEdge,
  lineupPositionOrder,
  minimumFlexCandidatesForAdvice,
} from "./constants.js";
import type {
  MyExpertAdviceCard,
  MyExpertLeagueSettings,
  MyExpertMatchupSignal,
  MyExpertNewsSignal,
  MyExpertPlayer,
} from "./contracts.js";
import { formatOneDecimal } from "./formatting.js";
import { rankedLineupPlayersFor, type RankedLineupPlayer } from "./lineupRanking.js";
import { lineupSelectionFor } from "./lineupSelection.js";
import { priorityForLineupEdge } from "./priorities.js";

interface RequiredStarter {
  slot: Position;
  rankedPlayer: RankedLineupPlayer;
}

const requiredStartersFor = (
  leagueSettings: MyExpertLeagueSettings,
  rankedPlayers: readonly RankedLineupPlayer[],
  usedPlayerIds: Set<string>,
): RequiredStarter[] | undefined => {
  const requiredStarters: RequiredStarter[] = [];
  for (const position of lineupPositionOrder) {
    const starterCount = leagueSettings.lineup[position] ?? 0;
    const starters = rankedPlayers
      .filter(candidate => candidate.player.position === position && !usedPlayerIds.has(candidate.player.id))
      .slice(0, starterCount);
    if (starters.length < starterCount) return undefined;
    for (const rankedPlayer of starters) {
      usedPlayerIds.add(rankedPlayer.player.id);
      requiredStarters.push({ slot: position, rankedPlayer });
    }
  }
  return requiredStarters;
};

export const lineupAdvisorCardFor = (
  currentWeek: number,
  leagueSettings: MyExpertLeagueSettings,
  roster: readonly MyExpertPlayer[],
  matchupScores: ReadonlyMap<string, number>,
  matchupSignalsByPlayer: ReadonlyMap<string, readonly MyExpertMatchupSignal[]>,
  newsByPlayer: ReadonlyMap<string, readonly MyExpertNewsSignal[]>,
): MyExpertAdviceCard | undefined => {
  const rankedPlayers = rankedLineupPlayersFor(roster, matchupScores, newsByPlayer);
  const usedPlayerIds = new Set<string>();
  const requiredStarters = requiredStartersFor(leagueSettings, rankedPlayers, usedPlayerIds);
  if (!requiredStarters) return undefined;

  const flexCount = leagueSettings.lineup.FLEX ?? 0;
  if (flexCount <= 0) return undefined;
  const flexCandidates = rankedPlayers.filter(candidate =>
    flexEligiblePositions.has(candidate.player.position) && !usedPlayerIds.has(candidate.player.id)
  );
  if (flexCandidates.length < Math.max(minimumFlexCandidatesForAdvice, flexCount + 1)) return undefined;

  const flexStarters = flexCandidates.slice(0, flexCount);
  const flexChoice = flexStarters[0];
  if (!flexChoice) return undefined;
  const nextFlexCandidate = flexCandidates[flexCount];
  const requiredSelections = requiredStarters.map(({ slot, rankedPlayer }) =>
    lineupSelectionFor(rankedPlayer, slot, matchupSignalsByPlayer, newsByPlayer, `Top ${slot} option by adjusted weekly score.`)
  );
  const flexStarterSelections = flexStarters.map(rankedPlayer =>
    lineupSelectionFor(rankedPlayer, "FLEX", matchupSignalsByPlayer, newsByPlayer, "Best legal FLEX by adjusted weekly score.")
  );
  const flexCandidateSelections = flexCandidates.map((rankedPlayer, index) =>
    lineupSelectionFor(
      rankedPlayer,
      "FLEX",
      matchupSignalsByPlayer,
      newsByPlayer,
      index < flexCount ? "Best legal FLEX by adjusted weekly score." : "FLEX alternative ranked by adjusted weekly score.",
    )
  );
  const selectedStarters = [...requiredSelections, ...flexStarterSelections];
  const flexSelection = flexCandidateSelections[0];
  if (!flexSelection) return undefined;
  const lineupEdge = nextFlexCandidate ? flexChoice.adjustedScore - nextFlexCandidate.adjustedScore : highLineupEdge;

  return {
    id: `lineup-advisor-week-${currentWeek}`,
    type: "lineup",
    title: `Start ${flexSelection.name} at FLEX`,
    priority: priorityForLineupEdge(lineupEdge),
    playerIds: selectedStarters.map(starter => starter.playerId),
    action: { kind: "recommendation", readOnly: true, label: "Review lineup advice" },
    summary: `${flexSelection.name} is the best legal FLEX after filling required starters.`,
    reasons: [
      `${flexSelection.name} leads FLEX candidates at ${formatOneDecimal(flexSelection.adjustedScore)} adjusted points.`,
      ...(nextFlexCandidate
        ? [`Next FLEX option: ${nextFlexCandidate.player.name} at ${formatOneDecimal(nextFlexCandidate.adjustedScore)} adjusted points.`]
        : []),
    ],
    lineup: { starters: selectedStarters, flexChoice: flexSelection, flexCandidates: flexCandidateSelections },
  };
};
