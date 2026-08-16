import type {
  PracticeSimulationRun,
  PracticeSimulationSummary,
} from "../../api/simulationSchema";

const roster: PracticeSimulationRun["teams"][number]["roster"] = [{
  playerId: "player-1", playerName: "De'Von Achane", position: "RB", price: 50,
  rosterSlot: "RB1", source: "keeper", starter: true, week1Points: 16.1,
}, {
  overallPick: 8, playerId: "player-2", playerName: "Jared Goff", position: "QB",
  rosterSlot: "QB", source: "ai", starter: false, week1Points: 18,
}, {
  playerId: "player-3", playerName: "Bench Player", position: "WR", rosterSlot: "BENCH1",
  source: "human", starter: false, week1Points: 1,
}];

export const summary: PracticeSimulationSummary = {
  completedCount: 2,
  draftFormat: "auction",
  outcomes: [
    { favorite: false, rank: 1, runNumber: 1, userWeek1Points: 106.5 },
    { favorite: false, rank: 2, runNumber: 2, userWeek1Points: 99.2 },
  ],
  playerExposure: [
    { averagePrice: 15, count: 1, playerId: "price", playerName: "Jadarian Price", position: "RB", rate: 0.5 },
    { averagePick: 8, count: 1, playerId: "goff", playerName: "Jared Goff", position: "QB", rate: 0.5 },
    { count: 1, playerId: "bench", playerName: "Bench Player", position: "WR", rate: 0.5 },
  ],
  positionCounts: { RB: { perRun: 2, total: 4 } },
  runCount: 2,
  seedPrefix: "test",
  strategy: {
    preferredPositions: [], rawInput: "Draft Jadarian Price",
    summary: "Target Jadarian Price", warnings: ["Target cap was restrictive."],
  },
  targetOutcomes: [{ hitCount: 1, hitRate: 0.5, playerId: "price", playerName: "Jadarian Price" }],
};

export const firstRun: PracticeSimulationRun = {
  label: "Run 1", runNumber: 1, seed: "one",
  teams: [
    { budgetRemaining: 0, isUserTeam: true, roster, spent: 200, teamId: "short", teamName: "Short King", week1Points: 106.5 },
    { isUserTeam: false, roster: [], spent: 200, teamId: "owner04", teamName: "Sentinels", week1Points: 101.1 },
  ],
};

export const secondRun: PracticeSimulationRun = {
  label: "Run 2", runNumber: 2, seed: "two",
  teams: [{ isUserTeam: true, roster: [], teamId: "short", teamName: "Short King", week1Points: 99.2 }],
};
