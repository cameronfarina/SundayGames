import type { LeagueConnectionDetail } from "./leagueConnectionsSchema";
import { syncedConnectionFixture } from "./leagueConnections.fixture";

export const connectionDetailFixture: LeagueConnectionDetail = {
  connection: syncedConnectionFixture,
  league: {
    settings: {
      name: "Sleeper Friends League",
      season: "2026",
      teamCount: 2,
      rosterPositions: ["QB", "RB", "WR", "FLEX", "BN"],
      scoring: { rec: 1, pass_td: 4 },
      status: "in_season",
      playoffTeams: 6,
      playoffWeekStart: 14,
      waiverBudget: 100,
    },
    teams: [
      {
        providerTeamId: "1",
        name: "Giant Dolphins",
        ownerNames: ["2KSports", "feiyingx"],
        wins: 7,
        losses: 6,
        ties: 0,
        pointsFor: 1776.06,
        pointsAgainst: 1695.36,
        players: [
          {
            providerPlayerId: "4035",
            name: "Alvin Kamara",
            position: "RB",
            teamAbbreviation: "NO",
            lineupSlot: "RB",
            starter: true,
          },
          {
            providerPlayerId: "2133",
            name: "Jordy Nelson",
            position: "WR",
            injuryStatus: "QUESTIONABLE",
            starter: false,
          },
        ],
      },
      {
        providerTeamId: "2",
        name: "Team 2",
        ownerNames: [],
        wins: 6,
        losses: 7,
        ties: 1,
        pointsFor: 1500,
        pointsAgainst: 1610.5,
        players: [],
      },
    ],
    matchups: [
      {
        week: 1,
        matchupKey: "1-2",
        homeTeamId: "1",
        homePoints: 148.04,
        awayTeamId: "2",
        awayPoints: 101.5,
      },
      { week: 2, matchupKey: "2-bye-1", homeTeamId: "1", homePoints: 120.75 },
    ],
    syncedAt: "2026-08-19T12:00:00.000Z",
  },
};
