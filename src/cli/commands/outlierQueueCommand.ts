import { playerOutlierReviewQueueCsv } from "../../modeling/playerOutlierReviewQueue.js";
import type { CliArguments } from "../arguments.js";
import { playerOutlierQueue } from "../evidenceQueues.js";

export const runOutlierQueueCommand = async (arguments_: CliArguments): Promise<void> => {
  const queue = await playerOutlierQueue(arguments_, "outliers-queue");
  const format = arguments_.option("--format") ?? "json";
  if (format === "csv") {
    console.log(playerOutlierReviewQueueCsv(queue));
    return;
  }
  if (format !== "json") throw new Error(`Unknown outlier queue format "${format}". Use json or csv.`);
  console.log(JSON.stringify(queue, null, 2));
};
