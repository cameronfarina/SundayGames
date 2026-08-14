import fs from "node:fs/promises";
import type { SeasonLongProjectionInput } from "./contracts.js";
import { seasonLongProjectionDocumentFor } from "./validation.js";

export const loadSeasonLongProjectionInputs = async (
  path: string,
): Promise<readonly SeasonLongProjectionInput[]> => {
  const parsed: unknown = JSON.parse(await fs.readFile(path, "utf8"));
  return seasonLongProjectionDocumentFor(parsed);
};
