import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { PlayerContextEvidence } from "../../../config/playerContext.js";
import type { LoadPlayerEvidenceSourceRowsOptions } from "./contracts.js";
import { parseScoredLocalCsv } from "./csvRows.js";
import { parseScoredLocalJson } from "./jsonRows.js";

export const loadPlayerEvidenceSourceRows = async ({
  path,
  adapter = "scored-local",
}: LoadPlayerEvidenceSourceRowsOptions): Promise<PlayerContextEvidence[]> => {
  if (adapter !== "scored-local") {
    throw new Error(`Unsupported player evidence source adapter "${adapter}".`);
  }
  const content = await readFile(path, "utf8");
  const extension = extname(path).toLowerCase();
  if (extension === ".csv") return parseScoredLocalCsv(content);
  if (extension === ".json") return parseScoredLocalJson(content);
  throw new Error(`Unsupported player evidence source file extension "${extension}". Use .csv or .json.`);
};
