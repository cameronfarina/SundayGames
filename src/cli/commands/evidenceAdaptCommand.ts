import {
  loadPlayerEvidenceSourceRows,
  playerContextEvidenceCsv,
} from "../../data/playerEvidenceSourceAdapters.js";
import type { CliArguments } from "../arguments.js";
import { evidenceSourceAdapterOption } from "../options/evidenceOptions.js";

export const runEvidenceAdaptCommand = async (arguments_: CliArguments): Promise<void> => {
  const rows = await loadPlayerEvidenceSourceRows({
    path: arguments_.required("--input"),
    adapter: evidenceSourceAdapterOption(arguments_),
  });
  const format = arguments_.option("--format") ?? "csv";
  if (format === "csv") {
    console.log(playerContextEvidenceCsv(rows));
    return;
  }
  if (format !== "json") throw new Error(`Unknown evidence adapter format "${format}". Use csv or json.`);
  console.log(JSON.stringify({ evidence: rows }, null, 2));
};
