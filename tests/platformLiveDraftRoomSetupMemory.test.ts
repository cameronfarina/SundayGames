import { describe, expect, it } from "vitest";
import {
  InMemoryLiveDraftRoomSetupRepository,
  liveDraftRoomSetupContentHash,
  type SaveLiveDraftRoomSetupInput,
} from "../src/platform/liveDraftRoomSetups.js";

const input: SaveLiveDraftRoomSetupInput = {
  seasonId: "season-2026",
  sourceVersion: "version-1",
  playerCatalog: [],
  initialRosters: [],
};

describe("in-memory live draft setup persistence", () => {
  it("replaces and clones setup snapshots", async () => {
    const repository = new InMemoryLiveDraftRoomSetupRepository();
    const saved = await repository.save(input);
    const replacement = { ...saved, sourceVersion: "version-2" };

    repository.replaceSetups([replacement]);
    const snapshots = repository.setups();

    expect(snapshots).toEqual([replacement]);
    expect(snapshots[0]).not.toBe(replacement);
    expect(await repository.findForSeason("missing")).toBeNull();
  });

  it("uses the current time and a stable canonical hash when omitted", async () => {
    const before = Date.now();
    const saved = await new InMemoryLiveDraftRoomSetupRepository().save(input);

    expect(saved.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(saved.contentHash).toBe(liveDraftRoomSetupContentHash(input));
  });
});
