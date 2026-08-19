import type { InSeasonTeam } from "./inSeasonSchema";

const gibbs = {
  playerId: "draft-player:jahmyr gibbs",
  playerName: "Jahmyr Gibbs",
  position: "RB",
  teamAbbreviation: "DET",
  byeWeek: 6,
  fantasyProsPlayerId: 1,
  weekly: { rankEcr: 1, positionRank: "RB1", rankMin: 1, rankMax: 2, rankStandardDeviation: 0.4 },
  restOfSeason: { rankEcr: 3, positionRank: "RB2", tier: 1, ecrDelta: 2 },
  weeklyProjectedPoints: 19.4,
  restOfSeasonProjectedPoints: 280.5,
} satisfies InSeasonTeam["players"][number];

const otton = {
  playerId: "draft-player:cade otton",
  playerName: "Cade Otton",
  position: "TE",
  teamAbbreviation: "TB",
  fantasyProsPlayerId: 6,
  weekly: { rankEcr: 35 },
  restOfSeason: { rankEcr: 140, tier: 13 },
  weeklyProjectedPoints: 11,
} satisfies InSeasonTeam["players"][number];

const legette = {
  playerId: "draft-player:xavier legette",
  playerName: "Xavier Legette",
  position: "WR",
  teamAbbreviation: "CAR",
  fantasyProsPlayerId: 5,
  weekly: { rankEcr: 32 },
  restOfSeason: { rankEcr: 130, tier: 12 },
  weeklyProjectedPoints: 9,
} satisfies InSeasonTeam["players"][number];

/** A kicker FantasyPros never ranks, so the UI has to say so out loud. */
const kicker = {
  playerId: "draft-player:cam little",
  playerName: "Cam Little",
  position: "K",
  teamAbbreviation: "JAX",
} satisfies InSeasonTeam["players"][number];

export const inSeasonTeam: InSeasonTeam = {
  configured: true,
  week: 3,
  updatedAt: "2026-09-17T09:00:00.000Z",
  players: [gibbs, otton, legette, kicker],
  lineup: {
    basis: "weekly_projection",
    slots: [
      {
        slot: "RB1",
        eligiblePositions: ["RB"],
        start: gibbs,
        pointEdge: 8.4,
      },
      {
        slot: "FLEX",
        eligiblePositions: ["RB", "WR", "TE"],
        start: otton,
        bench: legette,
        pointEdge: 2,
        concern: {
          basis: "weekly_ecr",
          rankGap: 3,
          message: "FantasyPros ranks Xavier Legette 3 spots ahead of Cade Otton in this week's consensus.",
        },
      },
    ],
  },
  waivers: {
    source: "widely_available",
    ownershipThreshold: 50,
    players: [
      {
        playerId: "draft-player:tyler shough",
        playerName: "Tyler Shough",
        position: "QB",
        teamAbbreviation: "NO",
        byeWeek: 11,
        fantasyProsPlayerId: 11,
        restOfSeason: { rankEcr: 125, tier: 12 },
        ownedEspn: 41.3,
        weeklyProjectedPoints: 14.2,
      },
      {
        playerId: "draft-player:jalen coker",
        playerName: "Jalen Coker",
        position: "WR",
        teamAbbreviation: "CAR",
        fantasyProsPlayerId: 10,
        restOfSeason: { rankEcr: 127, tier: 12 },
        ownedEspn: 37,
      },
    ],
  },
};
