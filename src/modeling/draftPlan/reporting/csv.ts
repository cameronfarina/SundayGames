import type { DraftPlanReport } from "../contracts.js";
import { joinedPlayerSummaries, playerSummary } from "../formatters.js";
import { playerAtPosition } from "../players.js";

type CsvValue = string | number | undefined;

const csvCell = (value: CsvValue): string => {
  const text = value === undefined ? "" : String(value);
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
};

const draftPlanCsvRows = (report: DraftPlanReport): CsvValue[][] =>
  report.candidates.map((candidate, index) => {
    const rb1 = candidate.rbCore[0];
    const rb2 = candidate.rbCore[1];
    const rb3 = candidate.rbCore[2];
    const wr1 = playerAtPosition(candidate, "WR", 0);
    const wr2 = playerAtPosition(candidate, "WR", 1);
    const te = playerAtPosition(candidate, "TE", 0);
    const kicker = playerAtPosition(candidate, "K", 0);
    const defense = playerAtPosition(candidate, "DST", 0);

    return [
      index + 1,
      candidate.seed,
      candidate.scenarioKey,
      candidate.owner,
      candidate.strategy,
      report.engineMode,
      candidate.rosterSpend,
      candidate.budgetRemaining,
      candidate.week1Score,
      candidate.weeks1To4Score,
      candidate.rbCoreSpend,
      rb1?.name,
      rb1?.price,
      rb2?.name,
      rb2?.price,
      rb3?.name,
      rb3?.price,
      wr1?.name,
      wr1?.price,
      wr2?.name,
      wr2?.price,
      te?.name,
      te?.price,
      kicker?.name,
      kicker?.price,
      defense?.name,
      defense?.price,
      candidate.lineup.map(entry => `${entry.slot}: ${playerSummary(entry.player)}`).join("; "),
      joinedPlayerSummaries(candidate.bench),
      joinedPlayerSummaries(candidate.players),
    ];
  });

export const draftPlanReportCsv = (report: DraftPlanReport): string =>
  [
    [
      "rank",
      "seed",
      "scenario",
      "owner",
      "strategy",
      "engine_mode",
      "roster_spend",
      "budget_remaining",
      "week1_score",
      "weeks1_to_4_score",
      "rb_core_spend",
      "rb1",
      "rb1_price",
      "rb2",
      "rb2_price",
      "rb3",
      "rb3_price",
      "wr1",
      "wr1_price",
      "wr2",
      "wr2_price",
      "te",
      "te_price",
      "k",
      "k_price",
      "dst",
      "dst_price",
      "lineup",
      "bench",
      "roster",
    ],
    ...draftPlanCsvRows(report),
  ].map(row => row.map(csvCell).join(",")).join("\n");
