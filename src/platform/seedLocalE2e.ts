import { pathToFileURL } from "node:url";
import { runLocalE2eSeedCli } from "./seedLocalE2e/cli.js";

export { loadLocalE2eSeedRuntime } from "./seedLocalE2e/runtime.js";
export { seedLocalE2e, seedLocalE2eFromEnv } from "./seedLocalE2e/seed.js";
export type {
  LocalE2eSeedEnv,
  LocalE2eSeedPlatformApp,
  LocalE2eSeedRuntime,
  LocalE2eSeedStorage,
  SeedLocalE2eAccount,
  SeedLocalE2eOpenTeam,
  SeedLocalE2eOptions,
  SeedLocalE2eResult,
  SeedLocalE2eRoomSummary,
  SeedLocalE2eSeasonSummary,
  SeedLocalE2eTeamClaim,
} from "./seedLocalE2e/contracts.js";

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runLocalE2eSeedCli();
}
