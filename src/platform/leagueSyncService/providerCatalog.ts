import {
  yahooPendingReviewMessage,
  type LeagueSyncProvider,
} from "../../data/leagueSyncProviderAdapters.js";

export type LeagueSyncProviderAvailability = "connectable" | "unavailable";

/** How the owner identifies a league to the provider on the add screen. */
export type LeagueSyncHandleKind = "sleeper-username" | "espn-league-id" | "none";

export interface LeagueSyncProviderCatalogEntry {
  provider: LeagueSyncProvider;
  label: string;
  availability: LeagueSyncProviderAvailability;
  handleKind: LeagueSyncHandleKind;
  handleLabel: string;
  handleHint: string;
  detail: string;
  /** True when a private league may ask for cookies after the first attempt. */
  supportsCookieCredentials: boolean;
  /**
   * True when the handle names exactly one league, so there is nothing to
   * choose and the league can be connected the moment it is found.
   */
  handleNamesOneLeague: boolean;
  /**
   * True when one lookup returns every league the owner plays in, so the add
   * screen can offer to find them all instead of asking league by league.
   */
  supportsAccountDiscovery: boolean;
}

export const leagueSyncProviderCatalog = (): readonly LeagueSyncProviderCatalogEntry[] => [
  {
    provider: "sleeper",
    label: "Sleeper",
    availability: "connectable",
    handleKind: "sleeper-username",
    handleLabel: "Sleeper username",
    handleHint: "Your Sleeper username, or a league ID if you know it.",
    detail: "Sleeper leagues connect with just a username. No password, no cookies.",
    supportsCookieCredentials: false,
    handleNamesOneLeague: false,
    supportsAccountDiscovery: true,
  },
  {
    provider: "espn",
    label: "ESPN",
    availability: "connectable",
    handleKind: "espn-league-id",
    handleLabel: "ESPN league ID or league URL",
    handleHint: "Paste the league URL from ESPN, or just the leagueId number in it.",
    detail:
      "Paste your league's address and Sunday Games takes it from there. Public leagues connect straight away.",
    supportsCookieCredentials: true,
    handleNamesOneLeague: true,
    supportsAccountDiscovery: true,
  },
  {
    provider: "yahoo",
    label: "Yahoo",
    availability: "unavailable",
    handleKind: "none",
    handleLabel: "Yahoo league",
    handleHint: "",
    detail: yahooPendingReviewMessage,
    supportsCookieCredentials: false,
    handleNamesOneLeague: false,
    supportsAccountDiscovery: false,
  },
];
