import {
  buildPlayerEvidenceCoverageAudit,
  playerEvidenceCoverageGatesCsv,
} from "../../modeling/playerEvidenceCoverage.js";
import type { CliArguments } from "../arguments.js";
import { playerEvidenceQueue } from "../evidenceQueues.js";

export const runEvidenceCoverageCommand = async (arguments_: CliArguments): Promise<void> => {
  const audit = buildPlayerEvidenceCoverageAudit(
    await playerEvidenceQueue(arguments_, "evidence-coverage"),
  );
  const format = arguments_.option("--format") ?? "json";
  if (format === "csv") {
    console.log(playerEvidenceCoverageGatesCsv(audit));
    return;
  }
  if (format !== "json") throw new Error(`Unknown evidence coverage format "${format}". Use json or csv.`);
  console.log(JSON.stringify(audit, null, 2));
};
