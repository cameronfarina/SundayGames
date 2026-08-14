import type { HistoricalBacktestReport } from "../historicalBacktest.js";
import type { MockSmokeReport } from "../mockSmoke.js";
import { toCsv } from "./csv.js";

export const mockSmokeFirstTwoRoundsCsv = (
  smokeReport: MockSmokeReport,
): string =>
  toCsv(
    [
      "pick", "round", "nominator", "winner", "player", "position",
      "anchor_price", "sale_price", "sale_vs_anchor", "budget_after_pick",
      "roster_slots_after_pick",
    ],
    smokeReport.firstTwoRounds.map(pick => [
      pick.pick, pick.round, pick.nominator, pick.winner, pick.player,
      pick.position, pick.anchorPrice, pick.salePrice, pick.saleVsAnchor,
      pick.budgetAfterPick, pick.rosterSlotsAfterPick,
    ]),
  );

export const historicalBacktestGatesCsv = (
  backtest: HistoricalBacktestReport,
): string =>
  toCsv(
    [
      "season", "source_seasons", "key", "category", "label", "status",
      "target", "actual", "delta", "warn_threshold", "fail_threshold",
    ],
    backtest.seasonBacktests.flatMap(seasonBacktest =>
      seasonBacktest.gates.items.map(gate => [
        seasonBacktest.season, seasonBacktest.sourceSeasons.join("; "),
        gate.key, gate.category, gate.label, gate.status, gate.target,
        gate.actual, gate.delta, gate.warnThreshold, gate.failThreshold,
      ]),
    ),
  );
