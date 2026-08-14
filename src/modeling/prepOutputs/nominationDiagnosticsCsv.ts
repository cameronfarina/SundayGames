import type { MockBatch } from "../mockBatch.js";
import { toCsv } from "./csv.js";

export const mockNominationDiagnosticsCsv = (batch: MockBatch): string =>
  toCsv(
    [
      "seed", "scenario", "pick", "nominator", "selected_player",
      "selected_position", "candidate_count", "candidate_rank",
      "candidate_player", "candidate_position", "market_price",
      "projection_total", "total_score", "market_price_score",
      "projection_score", "owner_need_score", "opponent_need_score",
      "affordability_score", "scarcity_score", "flush_money_score",
      "tie_break_score", "market_price_contribution",
      "projection_contribution", "owner_need_contribution",
      "opponent_need_contribution", "affordability_contribution",
      "scarcity_contribution", "flush_money_contribution",
      "tie_break_contribution",
    ],
    batch.runs.flatMap(run =>
      run.picks.flatMap(pick =>
        pick.nominationDiagnostics.topCandidates.map(candidate => [
          run.seed, run.keeperScenario.key, pick.pick, pick.nominator,
          pick.nominationDiagnostics.selectedPlayer,
          pick.nominationDiagnostics.selectedPosition,
          pick.nominationDiagnostics.candidateCount, candidate.rank,
          candidate.player, candidate.position, candidate.marketPrice,
          candidate.projectionTotal, candidate.score,
          candidate.scoreComponents.marketPrice,
          candidate.scoreComponents.projection,
          candidate.scoreComponents.ownerNeed,
          candidate.scoreComponents.opponentNeed,
          candidate.scoreComponents.affordability,
          candidate.scoreComponents.scarcity,
          candidate.scoreComponents.flushMoney,
          candidate.scoreComponents.tieBreak,
          candidate.weightedComponents.marketPrice,
          candidate.weightedComponents.projection,
          candidate.weightedComponents.ownerNeed,
          candidate.weightedComponents.opponentNeed,
          candidate.weightedComponents.affordability,
          candidate.weightedComponents.scarcity,
          candidate.weightedComponents.flushMoney,
          candidate.weightedComponents.tieBreak,
        ]),
      ),
    ),
  );
