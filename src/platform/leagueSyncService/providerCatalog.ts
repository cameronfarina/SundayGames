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
  supportsCookieCredentials: boolean;
  handleNamesOneLeague: boolean;
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
  },
  {
    provider: "espn",
    label: "ESPN",
    availability: "connectable",
    handleKind: "espn-league-id",
    handleLabel: "ESPN league ID or league URL (optional)",
    handleHint: "Leave this blank and paste your ESPN cookies below to find every league on your account.",
    detail: "Connect your ESPN account once to find its fantasy football leagues, or enter one league directly.",
    supportsCookieCredentials: true,
    handleNamesOneLeague: false,
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
  },
];
