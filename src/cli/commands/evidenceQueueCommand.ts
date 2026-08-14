import { playerEvidenceQueueCsv } from "../../modeling/playerEvidenceQueue.js";
import type { CliArguments } from "../arguments.js";
import { playerEvidenceQueue } from "../evidenceQueues.js";

export const runEvidenceQueueCommand = async (arguments_: CliArguments): Promise<void> => {
  const queue = await playerEvidenceQueue(arguments_, "evidence-queue");
  const format = arguments_.option("--format") ?? "json";
  if (format === "csv") {
    console.log(playerEvidenceQueueCsv(queue));
    return;
  }
  if (format !== "json") throw new Error(`Unknown evidence queue format "${format}". Use json or csv.`);
  console.log(JSON.stringify(queue, null, 2));
};
