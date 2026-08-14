import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { PlayerContextOverride } from "../../../config/playerContext.js";
import { parsePlayerContextCsv } from "./csvOverrides.js";
import { parsePlayerContextJson } from "./jsonOverrides.js";

export const loadPlayerContextOverrides = async (
  path: string,
): Promise<PlayerContextOverride[]> => {
  const content = await readFile(path, "utf8");
  const extension = extname(path).toLowerCase();
  if (extension === ".csv") return parsePlayerContextCsv(content);
  if (extension === ".json") return parsePlayerContextJson(content);
  throw new Error(`Unsupported player context file extension "${extension}". Use .csv or .json.`);
};
