import type {
  DiscoveredLeague,
  LeagueConnection,
  LeagueConnectionProviderInfo,
} from "./leagueConnectionsSchema";

export const providerCatalogFixture: readonly LeagueConnectionProviderInfo[] = [
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
    detail: "Yahoo reviews every Fantasy API application by hand, and Sunday Games is in that queue.",
    supportsCookieCredentials: false,
    handleNamesOneLeague: false,
  },
];

export const syncedConnectionFixture: LeagueConnection = {
  id: "connection-sleeper",
  provider: "sleeper",
  providerLeagueId: "289646328504385536",
  season: "2026",
  displayName: "Sleeper Friends League",
  status: "ok",
  lastSyncedAt: "2026-08-19T12:00:00.000Z",
  createdAt: "2026-08-18T12:00:00.000Z",
};

export const needsAttentionConnectionFixture: LeagueConnection = {
  id: "connection-espn",
  provider: "espn",
  providerLeagueId: "899513",
  season: "2026",
  displayName: "Pigskin Power Bottoms",
  status: "needs_attention",
  statusDetail: "This ESPN league is private. Paste your espn_s2 and SWID cookies to connect it.",
  createdAt: "2026-08-18T13:00:00.000Z",
};

export const connectionListFixture = {
  connections: [syncedConnectionFixture, needsAttentionConnectionFixture],
  providers: providerCatalogFixture,
};

export const comradesLeagueFixture: DiscoveredLeague = {
  providerLeagueId: "330813448747253760",
  name: "Comrades League",
  season: "2026",
  teamCount: 10,
};

export const discoveredLeaguesFixture = {
  provider: "sleeper",
  season: "2026",
  leagues: [
    {
      providerLeagueId: "289646328504385536",
      name: "Sleeper Friends League",
      season: "2026",
      teamCount: 12,
    },
    comradesLeagueFixture,
  ],
};
