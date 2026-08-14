import type {
  MyExpertLineupSelection,
  MyExpertLineupSlot,
  MyExpertMatchupSignal,
  MyExpertNewsSignal,
} from "./contracts.js";
import { roundToOneDecimal } from "./formatting.js";
import { lineupEvidenceFor, lineupRiskFor } from "./lineupEvidence.js";
import type { RankedLineupPlayer } from "./lineupRanking.js";

export const lineupSelectionFor = (
  rankedPlayer: RankedLineupPlayer,
  slot: MyExpertLineupSlot,
  matchupSignalsByPlayer: ReadonlyMap<string, readonly MyExpertMatchupSignal[]>,
  newsByPlayer: ReadonlyMap<string, readonly MyExpertNewsSignal[]>,
  reason: string,
): MyExpertLineupSelection => ({
  slot,
  playerId: rankedPlayer.player.id,
  name: rankedPlayer.player.name,
  position: rankedPlayer.player.position,
  projectedPoints: roundToOneDecimal(rankedPlayer.player.projectedPoints),
  adjustedScore: roundToOneDecimal(rankedPlayer.adjustedScore),
  reason,
  evidence: lineupEvidenceFor(rankedPlayer.player, matchupSignalsByPlayer, newsByPlayer),
  risk: lineupRiskFor(rankedPlayer.player, newsByPlayer),
});
