import { auctionMockResponseSchema } from "../api/mockDraftSchemas.js";
import { auctionMockResponseFixture } from "./auctionMockResponseFixture.js";

export const completedMockResponseFixture = () => {
  const base = auctionMockResponseFixture();
  return auctionMockResponseSchema.parse({
    ...base,
    mockSession: { ...base.mockSession, status: "completed" },
    results: {
      projectedPlayerCount: 2,
      rosteredPlayerCount: 2,
      teams: [
        {
          budgetRemaining: 0,
          isUserTeam: true,
          rank: 1,
          roster: [
            {
              playerId: "achane",
              playerName: "De'Von Achane",
              position: "RB",
              price: 50,
              rosterSlot: "RB1",
              source: "keeper",
              starter: true,
              week1Points: 16.1,
            },
          ],
          spent: 200,
          teamId: "team-owner11",
          teamName: "Short King",
          week1Points: 16.1,
        },
        {
          budgetRemaining: 0,
          isUserTeam: false,
          rank: 2,
          roster: [
            {
              playerId: "gibbs",
              playerName: "Jahmyr Gibbs",
              position: "RB",
              price: 76,
              rosterSlot: "RB1",
              source: "ai",
              starter: true,
              week1Points: 15.8,
            },
          ],
          spent: 200,
          teamId: "team-owner01",
          teamName: "Dart Vader",
          week1Points: 15.8,
        },
      ],
    },
    state: {
      ...base.state,
      session: {
        ...base.state.session,
        canComplete: false,
        canUndo: false,
        currentNomination: undefined,
        phase: "completed",
        status: "completed",
      },
    },
  });
};
