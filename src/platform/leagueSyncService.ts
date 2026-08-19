export { discoverLeaguesForProvider } from "./leagueSyncService/discoverLeagues.js";
export type {
  DiscoverLeaguesRequest,
  DiscoverLeaguesResult,
} from "./leagueSyncService/discoverLeagues.js";
export { failureFor } from "./leagueSyncService/failureStatus.js";
export type { LeagueSyncFailure } from "./leagueSyncService/failureStatus.js";
export {
  playerDirectoryMaxAgeMs,
  playerDirectoryTimeoutMs,
} from "./leagueSyncService/playerDirectory.js";
export { leagueSyncProviderCatalog } from "./leagueSyncService/providerCatalog.js";
export type {
  LeagueSyncHandleKind,
  LeagueSyncProviderAvailability,
  LeagueSyncProviderCatalogEntry,
} from "./leagueSyncService/providerCatalog.js";
export { syncLeagueConnection } from "./leagueSyncService/syncConnection.js";
export type {
  LeagueSyncServiceOptions,
  SyncConnectionResult,
} from "./leagueSyncService/syncConnection.js";
