import type { PlatformLeagueSetupImportInput } from "./contracts.js";

export const setupImportContent = (
  input: Pick<PlatformLeagueSetupImportInput, "content" | "rows">,
): string => input.content ?? input.rows?.join("\n") ?? "";
