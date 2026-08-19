import type { LeagueSyncAdapter, LeagueSyncProvider } from "./contracts.js";
import { espnLeagueSyncAdapter } from "./espn.js";
import { sleeperLeagueSyncAdapter } from "./sleeper.js";
import { yahooLeagueSyncAdapter } from "./yahoo.js";

export const leagueSyncAdapters: Readonly<Record<LeagueSyncProvider, LeagueSyncAdapter>> = {
  sleeper: sleeperLeagueSyncAdapter,
  espn: espnLeagueSyncAdapter,
  yahoo: yahooLeagueSyncAdapter,
};
