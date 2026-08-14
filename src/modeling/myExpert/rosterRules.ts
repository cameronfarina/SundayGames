import type { Position } from "../../../config/league.js";
import type { MyExpertLeagueSettings, MyExpertPlayer } from "./contracts.js";
import { dropScore, playerScoreWithMatchups } from "./scoring.js";

export type MyExpertPlayerWithBye = MyExpertPlayer & { byeWeek: number };

export const benchDropCandidates = (
  roster: readonly MyExpertPlayer[],
  matchupScores: ReadonlyMap<string, number>,
): MyExpertPlayer[] =>
  roster
    .filter(player => (player.rosteredRole ?? "bench") === "bench")
    .sort((left, right) =>
      dropScore(left, matchupScores) - dropScore(right, matchupScores) || left.name.localeCompare(right.name)
    );

const positionCountsFor = (roster: readonly MyExpertPlayer[]): Partial<Record<Position, number>> =>
  roster.reduce<Partial<Record<Position, number>>>((counts, player) => ({
    ...counts,
    [player.position]: (counts[player.position] ?? 0) + 1,
  }), {});

export const canAddAfterDrop = (
  leagueSettings: MyExpertLeagueSettings,
  roster: readonly MyExpertPlayer[],
  add: MyExpertPlayer,
  drop: MyExpertPlayer,
): boolean => {
  const maximum = leagueSettings.rosterMaximums[add.position];
  if (maximum === undefined) return true;

  const counts = positionCountsFor(roster);
  const adjustedCount = (counts[add.position] ?? 0) - (drop.position === add.position ? 1 : 0);
  return adjustedCount < maximum;
};

export const needsStarter = (leagueSettings: MyExpertLeagueSettings, position: Position): boolean =>
  (leagueSettings.lineup[position] ?? 0) > 0;

export const hasKnownBye = (player: MyExpertPlayer): player is MyExpertPlayerWithBye =>
  player.byeWeek !== undefined;

export const hasRosterCover = (
  roster: readonly MyExpertPlayer[],
  starter: MyExpertPlayer,
  byeWeek: number,
): boolean =>
  roster.some(player =>
    player.id !== starter.id &&
    player.position === starter.position &&
    player.rosteredRole !== "injured-reserve" &&
    player.byeWeek !== byeWeek
  );

export const bestRosterScoreFor = (
  roster: readonly MyExpertPlayer[],
  position: Position,
  matchupScores: ReadonlyMap<string, number>,
): number =>
  roster
    .filter(player => player.position === position && player.rosteredRole !== "injured-reserve")
    .reduce((best, player) => Math.max(best, playerScoreWithMatchups(player, matchupScores)), 0);
