import type { MyExpertAdviceCard, MyExpertLeagueSettings, MyExpertPlayer } from "./contracts.js";
import { slugFor } from "./formatting.js";
import { priorityForWeek } from "./priorities.js";
import { hasKnownBye, hasRosterCover, needsStarter } from "./rosterRules.js";
import { byScoreDesc } from "./scoring.js";

export const byeCoverageCardFor = (
  currentWeek: number,
  leagueSettings: MyExpertLeagueSettings,
  roster: readonly MyExpertPlayer[],
  availablePlayers: readonly MyExpertPlayer[],
  matchupScores: ReadonlyMap<string, number>,
): MyExpertAdviceCard | undefined => {
  const starterOptions = roster
    .filter(hasKnownBye)
    .filter(player =>
      player.rosteredRole === "starter" &&
      player.byeWeek >= currentWeek &&
      player.byeWeek <= currentWeek + 2 &&
      needsStarter(leagueSettings, player.position) &&
      !hasRosterCover(roster, player, player.byeWeek)
    )
    .sort((left, right) =>
      left.byeWeek - right.byeWeek ||
      left.position.localeCompare(right.position) ||
      left.name.localeCompare(right.name)
    );
  const starter = starterOptions.find(player =>
    availablePlayers.some(cover => cover.position === player.position && cover.byeWeek !== player.byeWeek)
  );
  if (!starter) return undefined;

  const cover = availablePlayers
    .filter(player => player.position === starter.position && player.byeWeek !== starter.byeWeek)
    .sort(byScoreDesc(matchupScores))[0];
  if (!cover) return undefined;

  return {
    id: `bye-coverage-week-${starter.byeWeek}-${starter.position.toLowerCase()}-${slugFor(cover.name)}`,
    type: "bye-coverage",
    title: `Cover Week ${starter.byeWeek} ${starter.position} bye with ${cover.name}`,
    priority: priorityForWeek(currentWeek, starter.byeWeek),
    playerIds: [starter.id, cover.id],
    action: { kind: "recommendation", readOnly: true, label: "Review bye coverage" },
    summary: `${starter.name} is on bye in Week ${starter.byeWeek}, and the roster has no same-position cover.`,
    reasons: [`${cover.name} is available and is not on bye in Week ${starter.byeWeek}.`],
  };
};
