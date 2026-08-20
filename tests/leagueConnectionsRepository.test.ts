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

    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.displayName).toBe("Renamed league");
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
      credentials: { espnS2: "s2-value", swid: "{GUID}" },
      now,
    });
    await repository.saveConnection({ ...saveInput, provider: "espn", now });

    expect(await repository.findCredentials(saved.id))
      .toEqual({ espnS2: "s2-value", swid: "{GUID}" });
  });

  it("hides one account's connections from another", async () => {
    const repository = new InMemoryLeagueConnectionRepository();

    const saved = await repository.saveConnection({ ...saveInput, now });

    expect(await repository.findConnection("account-2", saved.id)).toBeNull();
    expect(await repository.deleteConnection("account-2", saved.id)).toBe(false);
    expect(await repository.findConnection("account-1", saved.id)).not.toBeNull();
  });

  it("replaces the stored snapshot on every sync and drops it with the connection", async () => {
    const repository = new InMemoryLeagueConnectionRepository();
    const saved = await repository.saveConnection({ ...saveInput, now });

    await repository.saveSnapshot(saved.id, snapshot, now.toISOString());
    await repository.saveSnapshot(saved.id, {
      ...snapshot,
      matchups: [],
    }, "2026-08-20T12:00:00.000Z");
    const stored = await repository.findSnapshot(saved.id);
    await repository.deleteConnection("account-1", saved.id);

    expect(stored?.matchups).toEqual([]);
    expect(stored?.syncedAt).toBe("2026-08-20T12:00:00.000Z");
    expect(await repository.findSnapshot(saved.id)).toBeNull();
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

    expect(await repository.findConnection("account-1", saved.id)).toMatchObject({
      status: "needs_attention",
      statusDetail: "This ESPN league is private.",
      lastSyncedAt: now.toISOString(),
    });
  });

  it("stores one player directory per provider", async () => {
    const repository = new InMemoryLeagueConnectionRepository();

    await repository.savePlayerDirectory({
      provider: "sleeper",
      entries: { "4035": { name: "Alvin Kamara", position: "RB" } },
      fetchedAt: now.toISOString(),
    });

    expect(await repository.findPlayerDirectory("sleeper")).toEqual({
      provider: "sleeper",
      entries: { "4035": { name: "Alvin Kamara", position: "RB" } },
      fetchedAt: now.toISOString(),
    });
    expect(await repository.findPlayerDirectory("espn")).toBeNull();
  });

  it("returns copies so a caller cannot edit stored state in place", async () => {
    const repository = new InMemoryLeagueConnectionRepository();
    const saved = await repository.saveConnection({ ...saveInput, now });
    await repository.saveSnapshot(saved.id, snapshot, now.toISOString());

    const stored = await repository.findSnapshot(saved.id);
    const editable = stored?.teams[0];
    if (editable !== undefined) Object.assign(editable, { name: "Tampered" });

    expect((await repository.findSnapshot(saved.id))?.teams[0]?.name).toBe("Giant Dolphins");
  });
});
