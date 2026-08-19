import type {
  HistoricalImportSourceColumn,
  HistoricalImportSourceDelimiter,
  SlotPriceSlotColumn,
} from "./contracts.js";

export const delimiters: readonly HistoricalImportSourceDelimiter[] = [",", "\t", ";"];

export const sourceColumns: readonly HistoricalImportSourceColumn[] = [
  "owner",
  "player",
  "position",
  "price",
  "publicPrice",
  "seasonYear",
  "playerId",
  "keeper",
  "acquisitionType",
];

export const requiredColumns: readonly HistoricalImportSourceColumn[] = [
  "owner",
  "player",
  "position",
  "price",
];

export const headerAliases: Record<HistoricalImportSourceColumn, ReadonlySet<string>> = {
  owner: new Set(["owner", "team", "ownername"]),
  player: new Set(["player", "playername", "name"]),
  position: new Set(["pos", "position"]),
  price: new Set(["price", "amount", "cost", "salary"]),
  publicPrice: new Set([
    "publicvalue",
    "marketvalue",
    "projectedvalue",
    "espnvalue",
    "espnaav",
    "aav",
  ]),
  seasonYear: new Set(["year", "season", "seasonyear"]),
  playerId: new Set(["playerid", "espnid"]),
  keeper: new Set(["keeper", "iskeeper"]),
  acquisitionType: new Set(["acquisition", "acquisitiontype", "type"]),
};

export const slotHeaderAliases: Record<SlotPriceSlotColumn, ReadonlySet<string>> = {
  slot: new Set(["slot", "positionslot", "rankslot", "slotlabel"]),
  positionRank: new Set(["rank", "positionrank", "posrank", "slotnumber"]),
};

export const truthyKeeperValues = new Set(["true", "yes", "y", "keeper", "1"]);
export const falseyKeeperValues = new Set(["false", "no", "n", "auction", "0"]);
export const integerCellPattern = /^-?\d+(?:\.0+)?$/u;
export const rosterRowPattern = /^\d+$/u;
export const historicalPositions = new Set(["QB", "RB", "WR", "TE", "K", "DST", "DEF"]);
