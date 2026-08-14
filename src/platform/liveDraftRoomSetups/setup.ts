import { createHash } from "node:crypto";
import type { LiveDraftRoomSetup, SaveLiveDraftRoomSetupInput } from "./contracts.js";

const canonicalSetupPayload = (input: SaveLiveDraftRoomSetupInput): string => JSON.stringify({
  seasonId: input.seasonId,
  sourceVersion: input.sourceVersion,
  playerCatalog: input.playerCatalog,
  initialRosters: input.initialRosters,
});

export const liveDraftRoomSetupContentHash = (input: SaveLiveDraftRoomSetupInput): string =>
  createHash("sha256").update(canonicalSetupPayload(input)).digest("hex");

export const setupFor = (input: SaveLiveDraftRoomSetupInput): LiveDraftRoomSetup => ({
  seasonId: input.seasonId,
  sourceVersion: input.sourceVersion,
  playerCatalog: structuredClone(input.playerCatalog),
  initialRosters: structuredClone(input.initialRosters),
  contentHash: liveDraftRoomSetupContentHash(input),
  updatedAt: input.updatedAt ?? new Date(),
});
