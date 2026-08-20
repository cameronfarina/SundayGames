/**
 * Trimmed captures of real provider payloads, recorded 2026-08-19 from Sleeper
 * league 289646328504385536 and public ESPN league 899513. Field names and
 * shapes are verbatim; only the number of teams, players, and weeks is reduced.
 */

export const sleeperUserPayload = {
  user_id: "667279356739584",
  username: "feiyingx",
  display_name: "feiyingx",
};

export const sleeperUserLeaguesPayload = [
  {
    league_id: "289646328504385536",
    name: "Sleeper Friends League",
    season: "2018",
    status: "complete",
    total_rosters: 12,
    sport: "nfl",
  },
  {
    name: "League with no id",
    season: "2018",
  },
];

export const sleeperLeaguePayload = {
  league_id: "289646328504385536",
  name: "Sleeper Friends League",
  season: "2018",
  status: "complete",
  total_rosters: 2,
  roster_positions: ["QB", "RB", "RB", "WR", "FLEX", "DEF", "BN", "BN"],
  scoring_settings: { rec: 1, pass_td: 4, bonus_rec_yd_100: 0.5 },
  settings: {
    num_teams: 12,
    playoff_teams: 6,
    playoff_week_start: 14,
    waiver_budget: 100,
    last_scored_leg: 1,
    leg: 16,
    max_keepers: 1,
  },
};

export const sleeperDraftsPayload = [
  {
    draft_id: "289646328504385537",
    league_id: "289646328504385536",
    type: "snake",
    status: "complete",
    season: "2018",
    settings: { teams: 12, rounds: 15, slots_flex: 1 },
  },
];

export const sleeperLeagueUsersPayload = [
  {
    user_id: "457511950237696",
    display_name: "2KSports",
    metadata: { team_name: "Giant Dolphins" },
  },
  { user_id: "189140835533586432", display_name: "feiyingx", metadata: {} },
  { user_id: "999000111222333", display_name: "LeagueWatcher", metadata: {} },
];

export const sleeperRostersPayload = [
  {
    roster_id: 1,
    owner_id: "457511950237696",
    co_owners: ["189140835533586432"],
    players: ["4035", "788", "2133", "PHI", "1352"],
    starters: ["4035", "788", "0", "2133", "PHI"],
    settings: {
      wins: 7,
      losses: 6,
      ties: 0,
      fpts: 1776,
      fpts_decimal: 6,
      fpts_against: 1695,
      fpts_against_decimal: 36,
    },
  },
  {
    roster_id: 2,
    owner_id: "189140835533586432",
    players: ["421", "2449"],
    starters: ["421", "2449"],
    settings: { wins: 6, losses: 7, ties: 0, fpts: 1500, fpts_decimal: 0 },
  },
];

export const sleeperMatchupsWeekOnePayload = [
  { roster_id: 1, matchup_id: 2, points: 148.04, starters: ["4035"], players: ["4035"] },
  { roster_id: 2, matchup_id: 2, points: 101.5, starters: ["421"], players: ["421"] },
  { roster_id: 3, points: 88.25, starters: [], players: [] },
];

export const sleeperPlayersPayload = {
  "4035": { full_name: "Alvin Kamara", position: "RB", team: "NO" },
  "788": { full_name: "Derrick Henry", position: "RB", team: "BAL" },
  "2133": { full_name: "Jordy Nelson", position: "WR", team: null },
  "421": { full_name: "Julio Jones", position: "WR", team: "ATL" },
  PHI: { first_name: "Philadelphia", last_name: "Eagles", position: "DEF", team: "PHI" },
  "0000": { position: "RB" },
};

export const espnLeaguePayload = {
  id: 899513,
  seasonId: 2025,
  status: { isActive: true, isExpired: false },
  settings: {
    name: "Pigskin Power Bottoms",
    size: 12,
    rosterSettings: {
      lineupSlotCounts: { "1": 1, "15": 1, "16": 1, "17": 1, "20": 2, "21": 1, "23": 2, "99": 1 },
    },
    draftSettings: { type: "AUCTION", auctionBudget: 200, keeperCount: 2 },
    scoringSettings: {
      scoringItems: [
        { statId: 43, points: 6 },
        { statId: 4, points: 4 },
        { statId: 3, points: 0.04 },
        { statId: 42, points: 0.1 },
        { statId: 201, points: 3 },
      ],
    },
  },
  members: [
    { id: "{E29D59B3-F170-4B8A-9D59-B3F1702B8AD5}", displayName: "ChadOwner" },
    { id: "{DB332A0C-D5A9-4215-BE6D-3FBEBBB7855E}", firstName: "Sam", lastName: "Cole" },
    { id: "{05B95FAE-8345-4823-B95F-AE8345382379}", displayName: "mfespinosaIV" },
  ],
  teams: [
    {
      id: 1,
      abbrev: "LLM",
      name: "ChadGPT",
      owners: [
        "{E29D59B3-F170-4B8A-9D59-B3F1702B8AD5}",
        "{DB332A0C-D5A9-4215-BE6D-3FBEBBB7855E}",
      ],
      record: { overall: { wins: 8, losses: 6, ties: 0, pointsFor: 1551.26, pointsAgainst: 1410.9899999999998 } },
      roster: {
        entries: [
          {
            playerId: 3916655,
            lineupSlotId: 21,
            injuryStatus: "QUESTIONABLE",
            playerPoolEntry: {
              player: { id: 3916655, fullName: "Maxx Crosby", defaultPositionId: 10, proTeamId: 13 },
            },
          },
          {
            playerId: 4242335,
            lineupSlotId: 23,
            injuryStatus: "NORMAL",
            playerPoolEntry: {
              player: { id: 4242335, fullName: "Jonathan Taylor", defaultPositionId: 2, proTeamId: 11 },
            },
          },
        ],
      },
    },
    {
      id: 2,
      abbrev: "ME",
      name: "ATX Cochino",
      owners: ["{05B95FAE-8345-4823-B95F-AE8345382379}", "{UNKNOWN-MEMBER}"],
      record: { overall: { wins: 8, losses: 6, ties: 0, pointsFor: 1438.66, pointsAgainst: 1377.04 } },
      roster: {
        entries: [
          {
            playerId: 4258173,
            lineupSlotId: 20,
            injuryStatus: "NORMAL",
            playerPoolEntry: {
              player: { id: 4258173, fullName: "Nico Collins", defaultPositionId: 3, proTeamId: 34 },
            },
          },
        ],
      },
    },
  ],
  schedule: [
    { id: 1, matchupPeriodId: 1, winner: "HOME", home: { teamId: 2, totalPoints: 112.24 }, away: { teamId: 10, totalPoints: 69.82 } },
    { id: 2, matchupPeriodId: 1, winner: "HOME", home: { teamId: 1, totalPoints: 102.79 } },
    { id: 3, matchupPeriodId: 2, winner: "UNDECIDED", away: { teamId: 4, totalPoints: 0 } },
  ],
};

/**
 * The fan profile lists one entry per team the account holds, so a co-managed
 * league repeats. Other sports and other seasons share the same list.
 */
export const espnFanProfilePayload = {
  preferences: [
    {
      id: "fantasy-1",
      type: "FANTASY_FOOTBALL_TEAM",
      metaData: {
        entity: {
          gameId: "ffl",
          leagueId: 899513,
          seasonId: 2025,
          teamId: 1,
          leagueName: "Pigskin Power Bottoms",
        },
      },
    },
    {
      id: "fantasy-2",
      type: "FANTASY_FOOTBALL_TEAM",
      metaData: {
        entity: { gameId: "ffl", seasonId: 2025, teamId: 4, leagueId: 899513 },
      },
    },
    {
      id: "fantasy-3",
      type: "FANTASY_FOOTBALL_TEAM",
      metaData: {
        entity: {
          gameId: "ffl",
          seasonId: 2025,
          entryURL: "https://fantasy.espn.com/football/team?leagueId=424242&teamId=3&seasonId=2025",
        },
      },
    },
    {
      id: "fantasy-basketball",
      type: "FANTASY_BASKETBALL_TEAM",
      metaData: { entity: { gameId: "fba", leagueId: 777, seasonId: 2025 } },
    },
    {
      id: "fantasy-last-year",
      type: "FANTASY_FOOTBALL_TEAM",
      metaData: { entity: { gameId: "ffl", leagueId: 111222, seasonId: 2024 } },
    },
  ],
};

export const espnPrivateLeagueErrorBody = {
  messages: ["You are not authorized to view this League."],
  details: [{ type: "AUTH_LEAGUE_NOT_VISIBLE" }],
};
