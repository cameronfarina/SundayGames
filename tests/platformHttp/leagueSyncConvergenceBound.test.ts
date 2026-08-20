import { InMemoryLeagueConnectionRepository } from "../../src/platform/leagueConnections.js";
import { serviceOptionsFor } from "../../src/platform/http/routes/leagueConnections/context.js";
import { createAsyncReadWriteLock } from "../../src/platform/platformServer/serialization.js";
import { expect, it } from "./support/index.js";

const now = new Date("2026-08-20T12:00:00.000Z");
const snapshot = {
  settings: {
    name: "Changing provider league",
    season: "2026",
    teamCount: 1,
    rosterPositions: ["QB"],
    scoring: {},
  },
  teams: [],
  matchups: [],
};

it("bounds imported-season convergence while provider snapshots keep changing", async () => {
  const repository = new InMemoryLeagueConnectionRepository();
  const saved = await repository.saveConnection({
    accountId: "account-1",
    provider: "sleeper",
    providerLeagueId: "league-1",
    season: "2026",
    displayName: snapshot.settings.name,
    now,
  });
  await repository.linkConnectionToSeason(saved.id, "season-1");
  const connection = await repository.findConnection(saved.accountId, saved.id);
  if (connection === null) throw new Error("Expected the linked connection.");
  const initialRevision = await repository.beginConnectionSync(saved.id);
  if (initialRevision === null) throw new Error("Expected an initial sync revision.");
  await repository.saveSnapshot(saved.id, snapshot, now.toISOString(), initialRevision);
  const snapshotAccess = createAsyncReadWriteLock();
  let attempts = 0;
  const options = serviceOptionsFor({
    leagueConnectionRepository: repository,
    runLeagueSyncSeasonRefresh: async operation => await snapshotAccess.write(operation),
  }, async () => {
    attempts += 1;
    if (attempts > 6) throw new Error("Unbounded convergence probe.");
    const revision = await repository.beginConnectionSync(saved.id);
    if (revision === null) throw new Error("Expected the connection during convergence.");
    await repository.saveSnapshot(saved.id, snapshot, now.toISOString(), revision);
    return null;
  });

  await expect(options?.refreshImportedSeason?.({
    connection,
    snapshot,
    syncedAt: now.toISOString(),
    syncRevision: initialRevision,
  })).resolves.toMatch(/kept changing/u);
  await expect(snapshotAccess.write(async () => "released")).resolves.toBe("released");
  expect(attempts).toBeLessThanOrEqual(4);
});
