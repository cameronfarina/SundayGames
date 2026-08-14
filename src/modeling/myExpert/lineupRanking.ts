import type { MyExpertNewsSignal, MyExpertPlayer } from "./contracts.js";
import { playerScoreWithMatchups } from "./scoring.js";
import { newsAdjustmentTotal } from "./signalIndexes.js";

export interface RankedLineupPlayer {
  player: MyExpertPlayer;
  adjustedScore: number;
}

const lineupScoreFor = (
  player: MyExpertPlayer,
  matchupScores: ReadonlyMap<string, number>,
  newsByPlayer: ReadonlyMap<string, readonly MyExpertNewsSignal[]>,
): number =>
  playerScoreWithMatchups(player, matchupScores) + newsAdjustmentTotal(newsByPlayer.get(player.id) ?? []);

export const rankedLineupPlayersFor = (
  roster: readonly MyExpertPlayer[],
  matchupScores: ReadonlyMap<string, number>,
  newsByPlayer: ReadonlyMap<string, readonly MyExpertNewsSignal[]>,
): RankedLineupPlayer[] =>
  roster
    .filter(player => player.rosteredRole !== "injured-reserve")
    .map(player => ({
      player,
      adjustedScore: lineupScoreFor(player, matchupScores, newsByPlayer),
    }))
    .sort((left, right) =>
      right.adjustedScore - left.adjustedScore ||
      right.player.projectedPoints - left.player.projectedPoints ||
      left.player.name.localeCompare(right.player.name)
    );
