/**
 * ESPN answers with numeric ids for positions and pro teams. Both catalogs are
 * published by ESPN's own public season endpoint and change only when a
 * franchise moves, so they are recorded here rather than fetched on every sync.
 */
export const espnPositionNames: Readonly<Record<string, string>> = {
  "1": "QB",
  "2": "RB",
  "3": "WR",
  "4": "TE",
  "5": "K",
  "7": "P",
  "9": "DT",
  "10": "DE",
  "11": "LB",
  "12": "CB",
  "13": "S",
  "16": "DST",
};

export const espnProTeamAbbreviations: Readonly<Record<string, string>> = {
  "1": "ATL",
  "2": "BUF",
  "3": "CHI",
  "4": "CIN",
  "5": "CLE",
  "6": "DAL",
  "7": "DEN",
  "8": "DET",
  "9": "GB",
  "10": "TEN",
  "11": "IND",
  "12": "KC",
  "13": "LV",
  "14": "LAR",
  "15": "MIA",
  "16": "MIN",
  "17": "NE",
  "18": "NO",
  "19": "NYG",
  "20": "NYJ",
  "21": "PHI",
  "22": "ARI",
  "23": "PIT",
  "24": "LAC",
  "25": "SF",
  "26": "SEA",
  "27": "TB",
  "28": "WSH",
  "29": "CAR",
  "30": "JAX",
  "33": "BAL",
  "34": "HOU",
};

/**
 * Lineup slots for display. This is deliberately separate from the stricter map
 * in espnLeagueSettingsImport, which rejects any slot it does not recognise so
 * that league creation never invents a roster. A sync only renders what a
 * league already has, so an unknown slot falls back to its raw id instead.
 */
export const espnLineupSlotNames: Readonly<Record<string, string>> = {
  "0": "QB",
  "1": "TQB",
  "2": "RB",
  "3": "RB/WR",
  "4": "WR",
  "5": "WR/TE",
  "6": "TE",
  "7": "OP",
  "8": "DT",
  "9": "DE",
  "10": "LB",
  "11": "DL",
  "12": "CB",
  "13": "S",
  "14": "DB",
  "15": "DP",
  "16": "DST",
  "17": "K",
  "18": "P",
  "19": "HC",
  "20": "BN",
  "21": "IR",
  "23": "FLEX",
  "24": "ER",
};

/** ESPN keeps benched and injured-reserve players in the same roster array. */
export const espnBenchSlotIds = new Set(["20", "21", "24"]);
