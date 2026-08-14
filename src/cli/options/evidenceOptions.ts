import type { PlayerEvidenceSourceAdapterKey } from "../../data/playerEvidenceSourceAdapters.js";
import type { CliArguments } from "../arguments.js";

export const evidenceSourceAdapterOption = (
  arguments_: CliArguments,
): PlayerEvidenceSourceAdapterKey => {
  const value = arguments_.option("--adapter") ?? "scored-local";
  if (value === "scored-local") return value;
  throw new Error(`Unknown evidence source adapter "${value}". Use scored-local.`);
};
