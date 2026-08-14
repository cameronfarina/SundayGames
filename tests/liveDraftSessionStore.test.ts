import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FileBackedLiveDraftSessionStore,
  liveDraftCommandsCsv,
  liveDraftCommandsJson,
  parseLiveDraftCommandImport,
} from "../src/liveDraftSessionStore.js";

const tempSessionDirectory = async (): Promise<string> =>
  mkdtemp(join(tmpdir(), "mockd-live-draft-"));

const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, "utf8")) as T;

describe("live draft session store", () => {
  it("persists mutations to current, backup, and append-only audit files", async () => {
    const directory = await tempSessionDirectory();
    try {
      const store = new FileBackedLiveDraftSessionStore({ directory });

      await expect(store.load()).resolves.toEqual([]);
      await expect(store.appendCommand("owner05 drafted kittle for 28")).resolves.toEqual([
        "owner05 drafted kittle for 28",
      ]);

      const current = await readJson<{ commands: string[]; commandCount: number }>(store.paths.currentPath);
      const backup = await readJson<{ commands: string[]; commandCount: number }>(store.paths.backupPath);
      const logLines = (await readFile(store.paths.logPath, "utf8")).trim().split("\n");

      expect(current).toMatchObject({
        commandCount: 1,
        commands: ["owner05 drafted kittle for 28"],
      });
      expect(backup).toMatchObject(current);
      expect(logLines).toHaveLength(2);
      expect(JSON.parse(logLines[1] ?? "{}")).toMatchObject({
        sequence: 2,
        mutation: {
          type: "sale",
          command: "owner05 drafted kittle for 28",
        },
        commandCount: 1,
      });

      const reloadedStore = new FileBackedLiveDraftSessionStore({ directory });
      await expect(reloadedStore.load()).resolves.toEqual(["owner05 drafted kittle for 28"]);

      await expect(reloadedStore.undo()).resolves.toEqual([]);
      await expect(reloadedStore.importCommands([
        "owner11 drafted jahmyr gibbs for 80",
        "owner05 drafted george kittle for 28",
      ])).resolves.toEqual([
        "owner11 drafted jahmyr gibbs for 80",
        "owner05 drafted george kittle for 28",
      ]);
      await expect(reloadedStore.reset()).resolves.toEqual([]);

      const finalSnapshot = await readJson<{ commands: string[]; commandCount: number }>(
        reloadedStore.paths.currentPath,
      );
      expect(finalSnapshot).toMatchObject({ commandCount: 0, commands: [] });
      expect((await readFile(reloadedStore.paths.logPath, "utf8")).trim().split("\n")).toHaveLength(5);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("round-trips command imports and exports as JSON and CSV", () => {
    const commands = [
      "owner11 drafted jahmyr gibbs for 80",
      "owner05 drafted george kittle for 28",
    ];

    expect(parseLiveDraftCommandImport(liveDraftCommandsJson(commands), "json")).toEqual(commands);
    expect(parseLiveDraftCommandImport(JSON.stringify(commands), "json")).toEqual(commands);
    expect(parseLiveDraftCommandImport(JSON.stringify({
      version: 1,
      currentSnapshot: { commands },
      commandsJson: liveDraftCommandsJson(["fallback drafted player for 1"]),
    }), "json")).toEqual(commands);
    expect(liveDraftCommandsCsv(commands)).toBe(
      "index,command\n1,owner11 drafted jahmyr gibbs for 80\n2,owner05 drafted george kittle for 28\n",
    );
    expect(parseLiveDraftCommandImport(liveDraftCommandsCsv(commands), "csv")).toEqual(commands);
  });

  it("serializes concurrent mutations without dropping commands or corrupting snapshots", async () => {
    const directory = await tempSessionDirectory();
    try {
      const store = new FileBackedLiveDraftSessionStore({ directory });
      await store.load();

      const [firstResult, secondResult] = await Promise.all([
        store.appendCommand("owner11 drafted jahmyr gibbs for 76"),
        store.appendCommand("owner05 drafted george kittle for 28"),
      ]);

      expect([firstResult, secondResult]).toEqual([
        ["owner11 drafted jahmyr gibbs for 76"],
        ["owner11 drafted jahmyr gibbs for 76", "owner05 drafted george kittle for 28"],
      ]);
      expect(store.currentCommands()).toEqual([
        "owner11 drafted jahmyr gibbs for 76",
        "owner05 drafted george kittle for 28",
      ]);

      const current = await readJson<{ commands: string[]; commandCount: number }>(store.paths.currentPath);
      const backup = await readJson<{ commands: string[]; commandCount: number }>(store.paths.backupPath);
      const logLines = (await readFile(store.paths.logPath, "utf8")).trim().split("\n");

      expect(current).toMatchObject({
        commandCount: 2,
        commands: [
          "owner11 drafted jahmyr gibbs for 76",
          "owner05 drafted george kittle for 28",
        ],
      });
      expect(backup).toMatchObject(current);
      expect(logLines).toHaveLength(3);
      expect(logLines.map(line => JSON.parse(line) as { sequence: number }).map(line => line.sequence)).toEqual([1, 2, 3]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("recovers commands from the append-only audit log when snapshots are corrupted", async () => {
    const directory = await tempSessionDirectory();
    try {
      const store = new FileBackedLiveDraftSessionStore({ directory });
      await store.load();
      await store.appendCommand("owner11 drafted jahmyr gibbs for 76");
      await store.appendCommand("owner05 drafted george kittle for 28");
      await writeFile(store.paths.currentPath, "{ broken current", "utf8");
      await writeFile(store.paths.backupPath, "{ broken backup", "utf8");

      const reloadedStore = new FileBackedLiveDraftSessionStore({ directory });

      await expect(reloadedStore.load()).resolves.toEqual([
        "owner11 drafted jahmyr gibbs for 76",
        "owner05 drafted george kittle for 28",
      ]);
      expect(reloadedStore.currentCommands()).toEqual([
        "owner11 drafted jahmyr gibbs for 76",
        "owner05 drafted george kittle for 28",
      ]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("does not silently initialize an empty room when existing files are unrecoverable", async () => {
    const directory = await tempSessionDirectory();
    try {
      const store = new FileBackedLiveDraftSessionStore({ directory });
      await store.load();
      await writeFile(store.paths.currentPath, "{ broken current", "utf8");
      await rm(store.paths.backupPath, { force: true });
      await rm(store.paths.logPath, { force: true });

      const reloadedStore = new FileBackedLiveDraftSessionStore({ directory });

      await expect(reloadedStore.load()).rejects.toThrow("Unable to recover live draft session");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
