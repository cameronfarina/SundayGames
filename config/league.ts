export type Owner = string;
export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export const ownerOrder: readonly Owner[] = [
  "Owner01",
  "Owner02",
  "Owner03",
  "Owner04",
  "Owner05",
  "Owner06",
  "Owner07",
  "Owner08",
  "Owner09",
  "Owner10",
  "Owner11",
  "Owner12",
  "Owner13",
  "Owner14",
];

export const primaryOwner: Owner = ownerOrder[10] ?? "Owner11";

interface LeagueConfig {
  leagueId: number;
  teams: number;
  auctionBudget: number;
  rosterSize: number;
  scoring: {
    passingYards: number;
    passingTouchdown: number;
    rushingYards: number;
    rushingTouchdown: number;
    receivingYards: number;
    receivingTouchdown: number;
    reception: number;
  };
  lineup: Record<Position | "FLEX" | "BENCH", number>;
  rosterMaximums: Record<Position, number>;
}

export const leagueConfig: LeagueConfig = {
  leagueId: 100001,
  teams: 14,
  auctionBudget: 200,
  rosterSize: 16,
  scoring: {
    passingYards: 0.04,
    passingTouchdown: 4,
    rushingYards: 0.1,
    rushingTouchdown: 6,
    receivingYards: 0.1,
    receivingTouchdown: 6,
    reception: 0.5,
  },
  lineup: {
    QB: 1,
    RB: 2,
    WR: 2,
    TE: 1,
    FLEX: 1,
    K: 1,
    DST: 1,
    BENCH: 7,
  },
  rosterMaximums: {
    QB: 3,
    RB: 6,
    WR: 6,
    TE: 2,
    K: 2,
    DST: 2,
  },
};

export const positions: readonly Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];
