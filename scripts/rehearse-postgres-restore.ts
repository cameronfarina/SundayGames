import { pathToFileURL } from "node:url";
import { runPostgresRestoreRehearsalCli } from "./rehearsePostgresRestore/cli.js";

export { inspectPostgresDatabase } from "./rehearsePostgresRestore/database.js";
export { rehearsePostgresRestore } from "./rehearsePostgresRestore/rehearsal.js";
export { runPostgresRestoreRehearsalCli } from "./rehearsePostgresRestore/cli.js";
export type {
  PostgresDatabaseInspection,
  PostgresRestoreRehearsalResult,
  RehearsePostgresRestoreDependencies,
  RehearsePostgresRestoreOptions,
} from "./rehearsePostgresRestore/types.js";

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runPostgresRestoreRehearsalCli().then(exitCode => {
    process.exitCode = exitCode;
  });
}
