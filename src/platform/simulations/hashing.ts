import { createHash } from "node:crypto";
import type { CreateSimulationRequestInput } from "./runContracts.js";
import type { SimulationStrategy } from "./strategyContracts.js";

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  const entries = Object.entries(value).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  const serialized = entries
    .filter(([, entryValue]) => entryValue !== undefined)
    .map(([entryKey, entryValue]) => `${JSON.stringify(entryKey)}:${stableStringify(entryValue)}`);
  return `{${serialized.join(",")}}`;
};

export const hashSimulationInput = (input: unknown): string =>
  createHash("sha256").update(stableStringify(input)).digest("base64url");

export const simulationInputHashPayload = (
  input: Omit<CreateSimulationRequestInput, "createdAt">,
  strategy: SimulationStrategy,
): unknown => ({
  userId: input.userId,
  leagueId: input.leagueId,
  seasonId: input.seasonId,
  ownerId: input.ownerId,
  teamId: input.teamId,
  count: input.count,
  seedPrefix: input.seedPrefix,
  strategy,
});
