export const espnApiOrigin = "https://lm-api-reads.fantasy.espn.com";
export const espnMinimumBidDollars = 1;

export const scoringStatIds = {
  passingYard: 3,
  passingTouchdown: 4,
  rushingYard: 24,
  rushingTouchdown: 25,
  receivingYard: 42,
  receivingTouchdown: 43,
  reception: 53,
};

export const rosterSlotNames: Readonly<Record<string, string>> = {
  "0": "QB",
  "2": "RB",
  "3": "RB_WR",
  "4": "WR",
  "5": "WR_TE",
  "6": "TE",
  "7": "OP",
  "16": "DST",
  "17": "K",
  "20": "BENCH",
  "21": "IR",
  "23": "FLEX",
};
