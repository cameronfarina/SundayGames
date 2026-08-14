import type { Position } from "../../../config/league.js";
import { canonicalPlayerIdentityKey } from "../normalizePlayerName.js";
import type { EspnPpr300AuctionBaselineValue } from "./contracts.js";

const positions: readonly Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

const positionFor = (value: string | undefined): Position | undefined =>
  positions.find(position => position === value);

const integer = (value: string | undefined, label: string): number => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ESPN PPR Top 300 ${label}: ${value ?? "missing"}.`);
  }
  return parsed;
};

export const parseEspnPpr300AuctionBaselineRow = (
  row: string,
): EspnPpr300AuctionBaselineValue => {
  const [overallRank, rawPosition, positionRank, name, team, value, bye] = row.split("|");
  const position = positionFor(rawPosition);
  if (position === undefined) {
    throw new Error(`Invalid ESPN PPR Top 300 position: ${rawPosition ?? "missing"}.`);
  }
  if (!name || !team) {
    throw new Error(`Invalid ESPN PPR Top 300 player row: ${row}.`);
  }

  return Object.freeze({
    overallRank: integer(overallRank, "overall rank"),
    position,
    positionRank: integer(positionRank, "position rank"),
    name,
    normalizedName: canonicalPlayerIdentityKey(name),
    teamAbbreviation: team,
    auctionValue: integer(value, "auction value"),
    byeWeek: integer(bye, "bye week"),
  });
};
