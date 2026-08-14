import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { keepers } from "../config/keepers.js";
import { canonicalPlayerIdentityKey } from "../src/data/normalizePlayerName.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../src/platform/liveDraftRooms.js";
import {
  loadLocalDemoPlayerCatalog,
  localDemoEmail,
  localDemoPlayerCatalog,
} from "../src/platform/localDemoFixtures.js";
import {
  loadLocalE2eSeedRuntime,
  seedLocalE2e,
  seedLocalE2eFromEnv,
  type SeedLocalE2eOptions,
} from "../src/platform/seedLocalE2e.js";

const now = new Date("2026-08-09T12:00:00.000Z");

const playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[] = [
  { name: "Puka Nacua", position: "WR", expectedPrice: 73, teamAbbreviation: "LAR", byeWeek: 11 },
  { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72, teamAbbreviation: "DET", byeWeek: 6 },
  { name: "Amon-Ra St. Brown", position: "WR", expectedPrice: 67, teamAbbreviation: "DET", byeWeek: 6 },
];

const seedOptions: SeedLocalE2eOptions = {
  now,
  playerCatalog,
  initialRosters: [],
};

const asRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an object.`);
  }

  return z.record(z.string(), z.unknown()).parse(value);
};

const asArray = (value: unknown, label: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`Expected ${label} to be an array.`);

  return value;
};

describe("local E2E platform seed", () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory !== undefined) {
      await rm(directory, { force: true, recursive: true });
      directory = undefined;
    }
  });

  const storePath = async (): Promise<string> => {
    directory = await mkdtemp(join(tmpdir(), "mockd-e2e-seed-"));

    return join(directory, "platform-store.json");
  };

  it("seeds a file-backed local E2E runtime idempotently", async () => {
    const path = await storePath();
    const env = { MOCKD_PLATFORM_DATA_FILE: path };

    const first = await seedLocalE2eFromEnv(env, seedOptions);
    const second = await seedLocalE2eFromEnv(env, seedOptions);
    const saved = JSON.parse(await readFile(path, "utf8"));
    const savedAuth = JSON.parse(await readFile(`${path}.auth.json`, "utf8"));
    const root = asRecord(saved, "saved store");
    const auth = asRecord(asRecord(savedAuth, "saved auth sidecar").auth, "auth");
    const accounts = asArray(auth.accountCredentials, "auth.accountCredentials");
    const sessions = asArray(auth.sessions, "auth.sessions");
    const leagueSeasons = asArray(root.leagueSeasons, "leagueSeasons");
    const memberships = asArray(root.memberships, "memberships");
    const liveDraftRooms = asArray(root.liveDraftRooms, "liveDraftRooms");
    const room = asRecord(liveDraftRooms[0], "live room");

    expect(first.storage).toEqual({ kind: "file", path });
    expect(second.accounts.commissioner.accountId).toBe(first.accounts.commissioner.accountId);
    expect(second.accounts.manager.accountId).toBe(first.accounts.manager.accountId);
    expect(accounts).toHaveLength(2);
    expect(sessions).toHaveLength(2);
    expect(leagueSeasons).toHaveLength(1);
    expect(memberships).toHaveLength(2);
    expect(liveDraftRooms).toHaveLength(1);
    expect(room).toMatchObject({
      roomId: "room_mockd_e2e_2026",
      status: "live",
      revision: 2,
    });
    expect(asArray(room.events, "room.events").map(event => asRecord(event, "event").type)).toEqual([
      "room_created",
      "room_started",
    ]);
    expect(second.liveDraftRoom).toMatchObject({
      roomId: "room_mockd_e2e_2026",
      status: "live",
      revision: 2,
      boardCount: playerCatalog.length,
    });
    expect(second.teamClaims.commissioner.ownerDisplayName).toBe("Owner11");
    expect(second.teamClaims.manager.ownerDisplayName).toBe("Owner04");
  });

  it("preserves an existing seeded live room instead of recreating it", async () => {
    const path = await storePath();
    const env = { MOCKD_PLATFORM_DATA_FILE: path };
    const seeded = await seedLocalE2eFromEnv(env, seedOptions);
    const runtime = await loadLocalE2eSeedRuntime(env);

    try {
      const room = await runtime.app.logLiveDraftSale({
        actorSessionToken: seeded.accounts.commissioner.sessionToken,
        roomId: seeded.liveDraftRoom.roomId,
        expectedRevision: 2,
        idempotencyKey: "test:puka:62",
        sale: "Owner11 drafted Puka for 62",
        now: new Date(now.getTime() + 1_000),
      });

      expect(room.revision).toBe(3);
      await runtime.persist();
    } finally {
      await runtime.close();
    }

    const rerun = await seedLocalE2eFromEnv(env, seedOptions);
    const saved = JSON.parse(await readFile(path, "utf8"));
    const root = asRecord(saved, "saved store");
    const liveDraftRooms = asArray(root.liveDraftRooms, "liveDraftRooms");
    const room = asRecord(liveDraftRooms[0], "live room");

    expect(rerun.liveDraftRoom).toMatchObject({
      roomId: "room_mockd_e2e_2026",
      status: "live",
      revision: 3,
    });
    expect(asArray(room.events, "room.events").map(event => asRecord(event, "event").type)).toEqual([
      "room_created",
      "room_started",
      "sale_logged",
    ]);
  });

  it("seeds a realistic default local draft board", async () => {
    const path = await storePath();
    const env = { MOCKD_PLATFORM_DATA_FILE: path };
    const fullCatalog = await loadLocalDemoPlayerCatalog();

    const seeded = await seedLocalE2eFromEnv(env, { now });

    expect(localDemoPlayerCatalog.length).toBeGreaterThanOrEqual(60);
    expect(fullCatalog).toHaveLength(500);
    expect(new Set(fullCatalog.map(player => canonicalPlayerIdentityKey(player.name))).size).toBe(fullCatalog.length);
    expect(fullCatalog.filter(player => canonicalPlayerIdentityKey(player.name) === "james cook")).toHaveLength(1);
    expect(fullCatalog.some(player => player.position === "K")).toBe(true);
    expect(fullCatalog.some(player => player.position === "DST")).toBe(true);
    expect(seeded.liveDraftRoom).toMatchObject({
      roomId: "room_mockd_e2e_2026",
      status: "live",
      boardCount: fullCatalog.length - keepers.length,
      catalogCount: fullCatalog.length,
      initialRosterCount: keepers.length,
    });
  });

  it("rejects existing accounts whose password does not match the E2E fixture", async () => {
    const path = await storePath();
    const env = { MOCKD_PLATFORM_DATA_FILE: path };
    const runtime = await loadLocalE2eSeedRuntime(env);

    try {
      await runtime.app.createAccount({
        email: localDemoEmail,
        password: "not the seed password",
        now,
      });
      await runtime.persist();
    } finally {
      await runtime.close();
    }

    await expect(seedLocalE2eFromEnv(env, seedOptions)).rejects.toThrow(
      `Existing account ${localDemoEmail} does not match the local E2E seed password.`,
    );
  });

  it("can seed an already constructed app runtime", async () => {
    const path = await storePath();
    const runtime = await loadLocalE2eSeedRuntime({ MOCKD_PLATFORM_DATA_FILE: path });

    try {
      const result = await seedLocalE2e(runtime.app, {
        ...seedOptions,
        persist: runtime.persist,
      });

      expect(result.season).toMatchObject({
        id: "league-100001-season-2026",
        teamCount: 14,
      });
      expect(result.openTeams).toHaveLength(12);
    } finally {
      await runtime.close();
    }
  });
});
