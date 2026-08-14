import type { LocalE2eSeedStorage, SeedLocalE2eResult } from "./contracts.js";
import { seedLocalE2eFromEnv } from "./seed.js";

const storageLabel = (storage: LocalE2eSeedStorage | undefined): string => {
  if (storage === undefined) return "custom app runtime";
  if (storage.kind === "file") return storage.path;
  return storage.snapshotKey === undefined ? "Postgres" : `Postgres snapshot ${storage.snapshotKey}`;
};

const formatHumanResult = (result: SeedLocalE2eResult): string => [
  "Mockd local E2E seed ready.",
  `Storage: ${storageLabel(result.storage)}`,
  `Season: ${result.season.id} (${result.season.teamCount} teams)`,
  `Live room: ${result.liveDraftRoom.roomId} (${result.liveDraftRoom.status}, revision ${result.liveDraftRoom.revision})`,
  `Commissioner login: ${result.accounts.commissioner.email} / ${result.accounts.commissioner.password}`,
  `Manager login: ${result.accounts.manager.email} / ${result.accounts.manager.password}`,
  `Unclaimed teams: ${result.openTeams.length}`,
].join("\n");

export const runLocalE2eSeedCli = async (): Promise<void> => {
  try {
    const result = await seedLocalE2eFromEnv();
    console.log(process.argv.includes("--json") ? JSON.stringify(result, null, 2) : formatHumanResult(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
};
