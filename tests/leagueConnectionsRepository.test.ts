import { describe, expect, it } from "vitest";
import {
  InMemoryLeagueConnectionRepository,
  type LeagueSnapshot,
} from "../src/platform/leagueConnections.js";

const now = new Date("2026-08-19T12:00:00.000Z");

const snapshot: LeagueSnapshot = {
  settings: {
    name: "Sleeper Friends League",
    season: "2018",
    teamCount: 2,
    rosterPositions: ["QB", "BN"],
    scoring: { rec: 1 },
  },
  teams: [{
    providerTeamId: "1",
    name: "Giant Dolphins",
    ownerNames: ["2KSports"],
    wins: 7,
    losses: 6,
    ties: 0,
    pointsFor: 1776.06,
    pointsAgainst: 1695.36,
    players: [{ providerPlayerId: "4035", name: "Alvin Kamara", starter: true }],
  }],
  matchups: [{ week: 1, matchupKey: "1-2", homeTeamId: "1", homePoints: 148.04 }],
};

const saveInput = {
  accountId: "account-1",
  provider: "sleeper",
  providerLeagueId: "289646328504385536",
  season: "2018",
  displayName: "Sleeper Friends League",
} as const;

describe("in-memory league connection repository", () => {
  it("reconnects the same league instead of creating a duplicate", async () => {
    const repository = new InMemoryLeagueConnectionRepository();

    const first = await repository.saveConnection({ ...saveInput, now });
    const second = await repository.saveConnection({
      ...saveInput,
      displayName: "Renamed league",
      now: new Date("2026-08-20T12:00:00.000Z"),
    });
    const older = await repository.saveConnection({
      ...saveInput,
      displayName: "Stale rename",
      now,
    });

    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.displayName).toBe("Renamed league");
    expect(older.displayName).toBe("Renamed league");
    expect(await repository.listConnections("account-1")).toHaveLength(1);
  });

  it("remembers the imported season across a later reconnect", async () => {
    const repository = new InMemoryLeagueConnectionRepository();

    const saved = await repository.saveConnection({ ...saveInput, now });
    await repository.linkConnectionToSeason(saved.id, "season-1");
    const reconnected = await repository.saveConnection({ ...saveInput, now });

    expect(reconnected.leagueSeasonId).toBe("season-1");
  });

  it("keeps saved credentials when a later save omits them", async () => {
    const repository = new InMemoryLeagueConnectionRepository();

    const saved = await repository.saveConnection({
      ...saveInput,
      provider: "espn",
      credentialUpdate: {
        mode: "replace",
        credentials: { espnS2: "s2-value", swid: "{GUID}" },
      },
      now,
    });
    await repository.saveConnection({ ...saveInput, provider: "espn", now });

    expect(await repository.findCredentials(saved.id))
      .toEqual({ espnS2: "s2-value", swid: "{GUID}" });
  });

  it("clears saved credentials when a public reconnect requests it", async () => {
    const repository = new InMemoryLeagueConnectionRepository();
    const saved = await repository.saveConnection({
      ...saveInput,
      provider: "espn",
      credentialUpdate: {
        mode: "replace",
        credentials: { espnS2: "s2-value", swid: "{GUID}" },
      },
      now,
    });

    await repository.saveConnection({
      ...saveInput,
      provider: "espn",
      credentialUpdate: { mode: "clear" },
      now: new Date("2026-08-20T12:00:00.000Z"),
    });

    expect(await repository.findCredentials(saved.id)).toBeNull();
  });

  it("hides one account's connections from another", async () => {
    const repository = new InMemoryLeagueConnectionRepository();

    const saved = await repository.saveConnection({ ...saveInput, now });

    expect(await repository.findConnection("account-2", saved.id)).toBeNull();
    expect(await repository.deleteConnection("account-2", saved.id)).toBe(false);
    expect(await repository.findConnection("account-1", saved.id)).not.toBeNull();
  });

  it("keeps the newest stored snapshot and drops it with the connection", async () => {
    const repository = new InMemoryLeagueConnectionRepository();
    const saved = await repository.saveConnection({ ...saveInput, now });
    const syncRevision = await repository.beginConnectionSync(saved.id);
    if (syncRevision === null) throw new Error("Missing test sync.");

    await repository.saveSnapshot(saved.id, snapshot, now.toISOString(), syncRevision);
    await repository.saveSnapshot(saved.id, {
      ...snapshot,
      matchups: [],
    }, "2026-08-20T12:00:00.000Z", syncRevision);
    await expect(repository.saveSnapshot(saved.id, {
      ...snapshot,
      settings: { ...snapshot.settings, name: "Stale league" },
    }, now.toISOString(), syncRevision)).resolves.toBe(false);
    const stored = await repository.findSnapshot(saved.id);
    await repository.deleteConnection("account-1", saved.id);

    expect(stored?.matchups).toEqual([]);
    expect(stored?.syncedAt).toBe("2026-08-20T12:00:00.000Z");
    expect(await repository.findSnapshot(saved.id)).toBeNull();
  });

  it("uses a total sync revision when request timestamps are identical", async () => {
    const repository = new InMemoryLeagueConnectionRepository();
    const saved = await repository.saveConnection({ ...saveInput, now });
    const firstRevision = await repository.beginConnectionSync(saved.id);
    const secondRevision = await repository.beginConnectionSync(saved.id);
    if (firstRevision === null || secondRevision === null) throw new Error("Missing test sync.");

    await expect(repository.saveSnapshot(
      saved.id,
      { ...snapshot, settings: { ...snapshot.settings, name: "Fast winner" } },
      now.toISOString(),
      secondRevision,
    )).resolves.toBe(true);
    await expect(repository.saveSnapshot(
      saved.id,
      { ...snapshot, settings: { ...snapshot.settings, name: "Slow loser" } },
      now.toISOString(),
      firstRevision,
    )).resolves.toBe(false);

    expect(await repository.findSnapshot(saved.id)).toMatchObject({
      settings: { name: "Fast winner" },
      syncRevision: secondRevision,
    });
  });

  it("records a status and a plain-language detail without touching the sync time", async () => {
    const repository = new InMemoryLeagueConnectionRepository();
    const saved = await repository.saveConnection({ ...saveInput, now });

    await repository.updateConnectionStatus({
      id: saved.id,
      status: "ok",
      lastSyncedAt: now.toISOString(),
      now,
    });
    await repository.updateConnectionStatus({
      id: saved.id,
      status: "needs_attention",
      statusDetail: "This ESPN league is private.",
      now,
    });
    await repository.updateConnectionStatus({ id: "missing", status: "error", now });
    const newer = new Date("2026-08-20T12:00:00.000Z");
    await repository.updateConnectionStatus({
      id: saved.id,
      status: "error",
      statusDetail: "Newer provider failure.",
      now: newer,
    });
    await repository.updateConnectionStatus({
      id: saved.id,
      status: "ok",
      now,
    });

    expect(await repository.findConnection("account-1", saved.id)).toMatchObject({
      status: "error",
      statusDetail: "Newer provider failure.",
      lastSyncedAt: now.toISOString(),
    });
  });

  it("lets the current sync revision finish after storage-only metadata moves updatedAt", async () => {
    const repository = new InMemoryLeagueConnectionRepository();
    const saved = await repository.saveConnection({ ...saveInput, now });
    const syncRevision = await repository.beginConnectionSync(saved.id);
    if (syncRevision === null) throw new Error("Missing test sync revision.");
    const maintenanceTime = new Date("2026-08-20T13:00:00.000Z");
    await repository.updateConnectionStatus({
      id: saved.id,
      status: "pending",
      now: maintenanceTime,
    });

    await expect(repository.updateConnectionStatus({
      id: saved.id,
      status: "ok",
      expectedSyncRevision: syncRevision,
      lastSyncedAt: now.toISOString(),
      now,
    })).resolves.toBe(true);

    await expect(repository.findConnection("account-1", saved.id)).resolves.toMatchObject({
      status: "ok",
      lastSyncedAt: now.toISOString(),
      updatedAt: maintenanceTime.toISOString(),
    });
  });

  it("stores one player directory per provider", async () => {
    const repository = new InMemoryLeagueConnectionRepository();

    await repository.savePlayerDirectory({
      provider: "sleeper",
      entries: { "4035": { name: "Alvin Kamara", position: "RB" } },
      fetchedAt: now.toISOString(),
    });
    const newer = new Date("2026-08-20T12:00:00.000Z").toISOString();
    await repository.savePlayerDirectory({
      provider: "sleeper",
      entries: { "4035": { name: "Newer Alvin Kamara", position: "RB" } },
      fetchedAt: newer,
    });
    await repository.savePlayerDirectory({
      provider: "sleeper",
      entries: { "4035": { name: "Stale Alvin Kamara", position: "RB" } },
      fetchedAt: now.toISOString(),
    });
    await repository.savePlayerDirectory({
      provider: "sleeper",
      entries: { "4035": { name: "Equal-time overwrite", position: "RB" } },
      fetchedAt: newer,
    });

    expect(await repository.findPlayerDirectory("sleeper")).toEqual({
      provider: "sleeper",
      entries: { "4035": { name: "Newer Alvin Kamara", position: "RB" } },
      fetchedAt: newer,
    });
    expect(await repository.findPlayerDirectory("espn")).toBeNull();
  });

  it("returns copies so a caller cannot edit stored state in place", async () => {
    const repository = new InMemoryLeagueConnectionRepository();
    const saved = await repository.saveConnection({ ...saveInput, now });
    const syncRevision = await repository.beginConnectionSync(saved.id);
    if (syncRevision === null) throw new Error("Missing test sync.");
    await repository.saveSnapshot(saved.id, snapshot, now.toISOString(), syncRevision);

    const stored = await repository.findSnapshot(saved.id);
    const editable = stored?.teams[0];
    if (editable !== undefined) Object.assign(editable, { name: "Tampered" });

    expect((await repository.findSnapshot(saved.id))?.teams[0]?.name).toBe("Giant Dolphins");
  });
});
