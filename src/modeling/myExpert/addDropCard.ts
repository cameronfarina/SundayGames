import type { MyExpertAdviceCard, MyExpertLeagueSettings, MyExpertPlayer } from "./contracts.js";
import { slugFor } from "./formatting.js";
import { priorityForGain } from "./priorities.js";
import { benchDropCandidates, canAddAfterDrop } from "./rosterRules.js";
import { dropScore, playerScoreWithMatchups } from "./scoring.js";

export const addDropCardFor = (
  leagueSettings: MyExpertLeagueSettings,
  roster: readonly MyExpertPlayer[],
  availablePlayers: readonly MyExpertPlayer[],
  matchupScores: ReadonlyMap<string, number>,
): MyExpertAdviceCard | undefined => {
  const pairs = availablePlayers.flatMap(add =>
    benchDropCandidates(roster, matchupScores)
      .filter(drop => canAddAfterDrop(leagueSettings, roster, add, drop))
      .map(drop => {
        const addScore = playerScoreWithMatchups(add, matchupScores);
        const dropCandidateScore = dropScore(drop, matchupScores);
        return { add, drop, addScore, dropCandidateScore, gain: addScore - dropCandidateScore };
      })
  );
  const pair = pairs
    .filter(candidate => candidate.gain >= 3)
    .sort((left, right) =>
      right.gain - left.gain ||
      right.addScore - left.addScore ||
      left.add.name.localeCompare(right.add.name) ||
      left.drop.name.localeCompare(right.drop.name)
    )[0];
  if (!pair) return undefined;

  return {
    id: `add-drop-${slugFor(pair.add.name)}-${slugFor(pair.drop.name)}`,
    type: "add-drop",
    title: `Add ${pair.add.name}, drop ${pair.drop.name}`,
    priority: priorityForGain(pair.gain),
    playerIds: [pair.add.id, pair.drop.id],
    action: { kind: "recommendation", readOnly: true, label: "Review add/drop" },
    summary: `${pair.add.name} projects as a better year-long roster bet than ${pair.drop.name}.`,
    reasons: [
      `${pair.add.name} score: ${pair.addScore.toFixed(1)}.`,
      `${pair.drop.name} score: ${pair.dropCandidateScore.toFixed(1)}.`,
    ],
  };
};
