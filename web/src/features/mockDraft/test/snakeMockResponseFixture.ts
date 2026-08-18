import { snakeMockResponseSchema } from "../api/mockDraftSchemas.js";

const player = (id: string, name: string, position: string, rank: number) => ({
  adp: rank,
  available: true,
  byeWeek: 10,
  id,
  leagueExpectedPick: rank,
  name,
  position,
  rank,
  teamAbbreviation: "DET",
});

const pick = (overall: number, round: number, pickInRound: number, teamId: string, teamName: string) => ({
  overall,
  pickInRound,
  round,
  teamId,
  teamName,
});

export const snakeMockResponseFixture = () => snakeMockResponseSchema.parse({
  mockSession: {
    draftMode: { format: "snake" },
    id: "mock-1",
    revision: 3,
    seasonId: "season-1",
    status: "active",
    teamId: "team-owner11",
  },
  state: {
    board: {
      picks: [
        {
          ...pick(1, 1, 1, "team-owner04", "Sentinels"),
          selection: { playerId: "gibbs", rosterSlot: "RB1", source: "ai" },
        },
        pick(2, 1, 2, "team-owner11", "Short King"),
        pick(3, 2, 1, "team-owner11", "Short King"),
        pick(4, 2, 2, "team-owner04", "Sentinels"),
      ],
      players: [
        player("gibbs", "Jahmyr Gibbs", "RB", 1),
        player("chase", "Ja'Marr Chase", "WR", 2),
      ],
    },
    session: {
      canComplete: false,
      canUndo: true,
      currentPick: { overall: 2, pickInRound: 2, round: 1, teamId: "team-owner11" },
      humanTeamId: "team-owner11",
      id: "mock-1",
      orderType: "standard",
      revision: 3,
      rounds: 2,
      status: "active",
      teamOrder: ["team-owner04", "team-owner11"],
    },
    teams: [
      {
        id: "team-owner11",
        name: "Short King",
        roster: [],
        slots: [
          { eligiblePositions: ["RB"], slot: "RB1" },
          { eligiblePositions: ["WR"], slot: "WR1" },
        ],
      },
      {
        id: "team-owner04",
        name: "Sentinels",
        roster: [{ playerId: "gibbs", rosterSlot: "RB1", source: "ai" }],
        slots: [
          { eligiblePositions: ["RB"], playerId: "gibbs", slot: "RB1" },
          { eligiblePositions: ["WR"], slot: "WR1" },
        ],
      },
    ],
  },
});
